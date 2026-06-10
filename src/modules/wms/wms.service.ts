import { pool } from '../../db/client';
import { ServiceError } from '../auth/auth.service';
import {
  CreatePOBody,
  ReceiveStockBody,
  CreateSOBody,
  ConfirmPickBody,
  DispatchBody,
  GeneratePutawayBody,
  CompletePutawayBody,
  GenerateCheckTasksBody,
  ConfirmCheckBody,
  FailCheckBody,
  GenerateInvoiceBody,
} from './wms.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFloat(val: unknown): number {
  return parseFloat(String(val ?? '0'));
}

async function nextSequence(
  client: { query: (...args: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  table: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ${table} WHERE ${prefix === 'PO' ? 'po_number' : 'so_number'} LIKE $1`,
    [pattern]
  );
  const seq = parseInt(rows[0]?.count as string ?? '0', 10) + 1;
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export async function createPO(body: CreatePOBody, createdBy: string) {
  if (!body.lines?.length) {
    throw new ServiceError('INVALID_INPUT', 'PO must have at least one line', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const poNumber = await nextSequence(client as never, 'purchase_orders', 'PO');

    const { rows: [po] } = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_name, expected_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [poNumber, body.supplier_name, body.expected_date ?? null, body.notes ?? null, createdBy]
    );

    const lines = [];
    for (const line of body.lines) {
      const { rows: [poLine] } = await client.query(
        `INSERT INTO po_lines (po_id, product_id, qty_ordered, unit_cost)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [po.id, line.product_id, line.qty_ordered, line.unit_cost ?? null]
      );
      lines.push(poLine);
    }

    await client.query('COMMIT');
    return { ...po, lines };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPOs(filters: { status?: string; page: number; limit: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM purchase_orders ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const { rows } = await pool.query(
    `SELECT po.*, COUNT(pol.id)::int AS lines_count
     FROM purchase_orders po
     LEFT JOIN po_lines pol ON po.id = pol.po_id
     ${where}
     GROUP BY po.id
     ORDER BY po.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );

  return { data: rows, total };
}

export async function getPOById(id: string) {
  const { rows } = await pool.query(
    `SELECT po.*,
       COALESCE(json_agg(json_build_object(
         'id',           pol.id,
         'product_id',   pol.product_id,
         'sku',          p.sku,
         'product_name', p.name,
         'qty_ordered',  pol.qty_ordered::float,
         'qty_received', pol.qty_received::float,
         'unit_cost',    pol.unit_cost::float
       )) FILTER (WHERE pol.id IS NOT NULL), '[]') AS lines
     FROM purchase_orders po
     LEFT JOIN po_lines pol ON po.id = pol.po_id
     LEFT JOIN products p ON pol.product_id = p.id
     WHERE po.id = $1
     GROUP BY po.id`,
    [id]
  );
  return rows[0] ?? null;
}

export async function receiveStock(body: ReceiveStockBody, receivedBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: lineRows } = await client.query(
      `SELECT pol.*, po.status AS po_status, po.id AS purchase_order_id
       FROM po_lines pol
       JOIN purchase_orders po ON pol.po_id = po.id
       WHERE pol.id = $1
       FOR UPDATE`,
      [body.po_line_id]
    );
    const line = lineRows[0];

    if (!line) throw new ServiceError('NOT_FOUND', 'PO line not found', 404);

    if (!['pending', 'receiving'].includes(line.po_status as string)) {
      throw new ServiceError('INVALID_STATUS', 'PO is not open for receiving', 400);
    }

    if (body.qty_received <= 0) {
      throw new ServiceError('INVALID_QUANTITY', 'Quantity must be greater than 0', 400);
    }

    const cumulative = toFloat(line.qty_received) + body.qty_received;
    if (cumulative > toFloat(line.qty_ordered)) {
      throw new ServiceError(
        'INVALID_QUANTITY',
        `Would receive ${cumulative} but only ${line.qty_ordered} ordered`,
        400
      );
    }

    // Insert GRN log
    const { rows: [grn] } = await client.query(
      `INSERT INTO grn_logs
         (po_id, po_line_id, product_id, bin_id, qty_received, lot_number, expiry_date, received_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        line.purchase_order_id,
        body.po_line_id,
        line.product_id,
        body.bin_id,
        body.qty_received,
        body.lot_number ?? null,
        body.expiry_date ?? null,
        receivedBy,
      ]
    );

    // Update po_line qty_received
    await client.query(
      `UPDATE po_lines SET qty_received = qty_received + $1 WHERE id = $2`,
      [body.qty_received, body.po_line_id]
    );

    // Upsert inventory
    const { rows: invRows } = await client.query(
      `SELECT qty_on_hand FROM inventory
       WHERE product_id = $1 AND bin_id = $2 AND lot_number IS NOT DISTINCT FROM $3
       FOR UPDATE`,
      [line.product_id, body.bin_id, body.lot_number ?? null]
    );
    const newQty = toFloat(invRows[0]?.qty_on_hand) + body.qty_received;

    await client.query(
      `INSERT INTO inventory (product_id, bin_id, qty_on_hand, lot_number, expiry_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ON CONSTRAINT inventory_unique
       DO UPDATE SET qty_on_hand = $3, updated_at = NOW()`,
      [line.product_id, body.bin_id, newQty, body.lot_number ?? null, body.expiry_date ?? null]
    );

    // Check if all lines fully received → update PO status
    const { rows: allLines } = await client.query(
      `SELECT qty_ordered, qty_received FROM po_lines WHERE po_id = $1`,
      [line.purchase_order_id]
    );
    const allDone = allLines.every(l => toFloat(l.qty_received) >= toFloat(l.qty_ordered));
    await client.query(
      `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [allDone ? 'received' : 'receiving', line.purchase_order_id]
    );

    await client.query('COMMIT');
    return grn;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export async function createSO(body: CreateSOBody, createdBy: string) {
  if (!body.lines?.length) {
    throw new ServiceError('INVALID_INPUT', 'SO must have at least one line', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate stock availability for all lines
    const shortages: { sku: string; requested: number; available: number }[] = [];
    for (const line of body.lines) {
      const { rows } = await client.query(
        `SELECT p.sku, COALESCE(SUM(i.qty_on_hand - i.qty_reserved), 0)::float AS qty_available
         FROM products p
         LEFT JOIN inventory i ON p.id = i.product_id
         WHERE p.id = $1
         GROUP BY p.sku`,
        [line.product_id]
      );
      const available = toFloat(rows[0]?.qty_available);
      if (available < line.qty_ordered) {
        shortages.push({ sku: rows[0]?.sku as string, requested: line.qty_ordered, available });
      }
    }

    if (shortages.length > 0) {
      const detail = shortages.map(s => `${s.sku} (need ${s.requested}, have ${s.available})`).join('; ');
      throw new ServiceError('INSUFFICIENT_STOCK', `Insufficient stock: ${detail}`, 400);
    }

    const soNumber = await nextSequence(client as never, 'sales_orders', 'SO');

    const { rows: [so] } = await client.query(
      `INSERT INTO sales_orders (so_number, customer_name, required_date, notes, branch_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [soNumber, body.customer_name, body.required_date ?? null, body.notes ?? null, body.branch_id ?? null, createdBy]
    );

    const lines = [];
    for (const line of body.lines) {
      const { rows: [soLine] } = await client.query(
        `INSERT INTO so_lines (so_id, product_id, qty_ordered, unit_price) VALUES ($1, $2, $3, $4) RETURNING *`,
        [so.id, line.product_id, line.qty_ordered, line.unit_price ?? 0]
      );
      lines.push(soLine);

      // Reserve from the bin with the most available stock
      const { rows: invRows } = await client.query(
        `SELECT id FROM inventory
         WHERE product_id = $1
         ORDER BY (qty_on_hand - qty_reserved) DESC
         LIMIT 1
         FOR UPDATE`,
        [line.product_id]
      );
      if (invRows[0]) {
        await client.query(
          `UPDATE inventory SET qty_reserved = qty_reserved + $1, updated_at = NOW() WHERE id = $2`,
          [line.qty_ordered, invRows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    return { ...so, lines };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSOs(filters: { status?: string; page: number; limit: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM sales_orders ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const { rows } = await pool.query(
    `SELECT so.*, COUNT(sol.id)::int AS lines_count
     FROM sales_orders so
     LEFT JOIN so_lines sol ON so.id = sol.so_id
     ${where}
     GROUP BY so.id
     ORDER BY so.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );

  return { data: rows, total };
}

export async function getSOById(id: string) {
  const { rows } = await pool.query(
    `SELECT so.*,
       COALESCE(json_agg(json_build_object(
         'id',           sol.id,
         'product_id',   sol.product_id,
         'sku',          p.sku,
         'product_name', p.name,
         'qty_ordered',  sol.qty_ordered::float,
         'qty_picked',   sol.qty_picked::float
       )) FILTER (WHERE sol.id IS NOT NULL), '[]') AS lines
     FROM sales_orders so
     LEFT JOIN so_lines sol ON so.id = sol.so_id
     LEFT JOIN products p ON sol.product_id = p.id
     WHERE so.id = $1
     GROUP BY so.id`,
    [id]
  );
  return rows[0] ?? null;
}

// ─── Pick Tasks ───────────────────────────────────────────────────────────────

export async function generatePickTasks(soId: string, assignedTo: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: soRows } = await client.query(
      `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [soId]
    );
    if (!soRows[0]) throw new ServiceError('NOT_FOUND', 'Sales order not found', 404);
    if (soRows[0].status !== 'pending') {
      throw new ServiceError('INVALID_STATUS', `SO must be 'pending' to generate tasks. Current: ${soRows[0].status}`, 400);
    }

    const { rows: soLines } = await client.query(
      `SELECT * FROM so_lines WHERE so_id = $1`,
      [soId]
    );

    const tasks = [];
    for (const line of soLines) {
      const { rows: binRows } = await client.query(
        `SELECT bin_id FROM inventory
         WHERE product_id = $1 AND qty_on_hand > 0
         ORDER BY qty_on_hand DESC
         LIMIT 1`,
        [line.product_id]
      );
      if (!binRows[0]) {
        throw new ServiceError('NOT_FOUND', 'No stock found for a product in this SO', 404);
      }

      const { rows: [task] } = await client.query(
        `INSERT INTO pick_tasks (so_id, so_line_id, product_id, bin_id, assigned_to, qty_to_pick)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [soId, line.id, line.product_id, binRows[0].bin_id, assignedTo, line.qty_ordered]
      );
      tasks.push(task);
    }

    await client.query(
      `UPDATE sales_orders SET status = 'picking', updated_at = NOW() WHERE id = $1`,
      [soId]
    );

    await client.query('COMMIT');
    return tasks;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMyPickTasks(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT pt.*,
            p.sku, p.name AS product_name,
            bl.aisle, bl.bay, bl.level,
            w.name AS warehouse_name
     FROM pick_tasks pt
     JOIN products p       ON pt.product_id = p.id
     JOIN bin_locations bl ON pt.bin_id = bl.id
     JOIN warehouses w     ON bl.warehouse_id = w.id
     WHERE pt.assigned_to = $1 AND pt.status != 'completed'
     ORDER BY pt.created_at`,
    [employeeId]
  );
  return rows;
}

export async function confirmPick(body: ConfirmPickBody, employeeId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: taskRows } = await client.query(
      `SELECT * FROM pick_tasks WHERE id = $1 FOR UPDATE`,
      [body.pick_task_id]
    );
    const task = taskRows[0];

    if (!task) throw new ServiceError('NOT_FOUND', 'Pick task not found', 404);
    if (task.assigned_to !== employeeId) {
      throw new ServiceError('FORBIDDEN', 'This task is not assigned to you', 403);
    }
    if (task.status === 'completed') {
      throw new ServiceError('INVALID_STATUS', 'Task is already completed', 400);
    }
    if (body.qty_picked > toFloat(task.qty_to_pick)) {
      throw new ServiceError('INVALID_QUANTITY', 'qty_picked exceeds qty_to_pick', 400);
    }
    if (body.bin_id !== task.bin_id) {
      throw new ServiceError('INVALID_BIN', 'Scanned bin does not match assigned bin', 400);
    }

    const { rows: [updatedTask] } = await client.query(
      `UPDATE pick_tasks
       SET qty_picked = $1, status = 'completed', completed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [body.qty_picked, body.pick_task_id]
    );

    await client.query(
      `UPDATE inventory
       SET qty_on_hand  = qty_on_hand  - $1,
           qty_reserved = GREATEST(qty_reserved - $1, 0),
           updated_at   = NOW()
       WHERE product_id = $2 AND bin_id = $3`,
      [body.qty_picked, task.product_id, task.bin_id]
    );

    await client.query(
      `UPDATE so_lines SET qty_picked = qty_picked + $1 WHERE id = $2`,
      [body.qty_picked, task.so_line_id]
    );

    const { rows: remaining } = await client.query(
      `SELECT id FROM pick_tasks WHERE so_id = $1 AND status != 'completed'`,
      [task.so_id]
    );
    if (remaining.length === 0) {
      await client.query(
        `UPDATE sales_orders SET status = 'packed', updated_at = NOW() WHERE id = $1`,
        [task.so_id]
      );
    }

    await client.query('COMMIT');
    return updatedTask;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatchSO(body: DispatchBody, dispatchedBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(
      `SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [body.so_id]
    );
    if (!so) throw new ServiceError('NOT_FOUND', 'Sales order not found', 404);

    const dispatchable = ['checked', 'invoiced', 'packed', 'ready_to_dispatch'];
    if (!dispatchable.includes(so.status as string)) {
      throw new ServiceError('INVALID_STATUS', `SO cannot be dispatched from status '${so.status as string}'`, 400);
    }

    // Auto-generate invoice if one doesn't exist yet
    const { rows: existingInv } = await client.query(
      `SELECT id FROM sales_invoices WHERE so_id = $1`, [body.so_id]
    );
    if (existingInv.length === 0) {
      const year = new Date().getFullYear();
      const { rows: [{ count }] } = await client.query(
        `SELECT COUNT(*) FROM sales_invoices WHERE si_number LIKE $1`, [`SI-${year}-%`]
      );
      const siNumber = `SI-${year}-${String(parseInt(count as string) + 1).padStart(3, '0')}`;

      const { rows: [invoice] } = await client.query(
        `INSERT INTO sales_invoices (si_number, so_id, customer_name, status, issued_at, created_by)
         VALUES ($1, $2, $3, 'issued', NOW(), $4) RETURNING *`,
        [siNumber, body.so_id, so.customer_name, dispatchedBy]
      );

      const { rows: soLines } = await client.query(
        `SELECT sol.product_id, sol.qty_ordered, sol.unit_price,
                p.sku, p.name, p.uom, p.unit_price AS catalog_price
         FROM so_lines sol JOIN products p ON sol.product_id = p.id
         WHERE sol.so_id = $1`,
        [body.so_id]
      );

      let total = 0;
      for (const line of soLines) {
        const unitPrice = toFloat(line.unit_price) > 0 ? toFloat(line.unit_price) : toFloat(line.catalog_price);
        const lineTotal = unitPrice * toFloat(line.qty_ordered);
        total += lineTotal;
        await client.query(
          `INSERT INTO si_lines (si_id, product_id, product_sku, product_name, uom, qty, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [invoice.id, line.product_id, line.sku, line.name, line.uom, Math.round(toFloat(line.qty_ordered)), unitPrice, lineTotal]
        );
      }

      await client.query(
        `UPDATE sales_invoices SET total_amount = $1, balance_due = $1, payment_status = 'unpaid' WHERE id = $2`,
        [total, invoice.id]
      );
    }

    const { rows: [dispatched] } = await client.query(
      `UPDATE sales_orders SET status = 'dispatched', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [body.so_id]
    );

    await client.query('COMMIT');
    return dispatched;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Putaway ──────────────────────────────────────────────────────────────────

export async function generatePutaway(body: GeneratePutawayBody, _userId: string) {
  const { rows: [grn] } = await pool.query(
    `SELECT id, product_id FROM grn_logs WHERE id = $1`,
    [body.grn_log_id]
  );
  if (!grn) throw new ServiceError('NOT_FOUND', 'GRN log not found', 404);

  const { rows: [task] } = await pool.query(
    `INSERT INTO putaway_tasks
       (grn_log_id, product_id, qty, from_bin_id, to_bin_id, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [body.grn_log_id, grn.product_id, body.qty, body.from_bin_id, body.to_bin_id, body.assigned_to]
  );
  return task;
}

export async function getMyPutawayTasks(userId: string) {
  const { rows } = await pool.query(
    `SELECT pt.*,
            p.sku AS product_sku, p.name AS product_name,
            fb.aisle AS from_aisle, fb.bay AS from_bay, fb.level AS from_level,
            tb.aisle AS to_aisle,   tb.bay AS to_bay,   tb.level AS to_level
     FROM putaway_tasks pt
     JOIN products p       ON pt.product_id  = p.id
     JOIN bin_locations fb ON pt.from_bin_id = fb.id
     JOIN bin_locations tb ON pt.to_bin_id   = tb.id
     WHERE pt.assigned_to = $1 AND pt.status = 'pending'
     ORDER BY pt.created_at`,
    [userId]
  );
  return rows;
}

export async function completePutaway(body: CompletePutawayBody, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [task] } = await client.query(
      `SELECT * FROM putaway_tasks WHERE id = $1 FOR UPDATE`,
      [body.putaway_task_id]
    );
    if (!task) throw new ServiceError('NOT_FOUND', 'Putaway task not found', 404);
    if (task.status === 'completed') throw new ServiceError('INVALID_STATUS', 'Task already completed', 409);
    if (body.scanned_bin_id !== task.to_bin_id) {
      throw new ServiceError('INVALID_BIN', 'Scanned bin does not match destination bin', 400);
    }

    const { rows: [grn] } = await client.query(
      `SELECT lot_number FROM grn_logs WHERE id = $1`,
      [task.grn_log_id]
    );

    // Reduce from staging bin
    await client.query(
      `UPDATE inventory
       SET qty_on_hand = qty_on_hand - $1, updated_at = NOW()
       WHERE product_id = $2 AND bin_id = $3 AND lot_number IS NOT DISTINCT FROM $4`,
      [task.qty, task.product_id, task.from_bin_id, grn?.lot_number ?? null]
    );

    // Upsert to rack bin
    const { rows: rackInv } = await client.query(
      `SELECT qty_on_hand FROM inventory
       WHERE product_id = $1 AND bin_id = $2 AND lot_number IS NOT DISTINCT FROM $3
       FOR UPDATE`,
      [task.product_id, task.to_bin_id, grn?.lot_number ?? null]
    );
    const newQty = toFloat(rackInv[0]?.qty_on_hand) + toFloat(task.qty);

    await client.query(
      `INSERT INTO inventory (product_id, bin_id, qty_on_hand, lot_number, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ON CONSTRAINT inventory_unique
       DO UPDATE SET qty_on_hand = $3, updated_at = NOW()`,
      [task.product_id, task.to_bin_id, newQty, grn?.lot_number ?? null]
    );

    const { rows: [updated] } = await client.query(
      `UPDATE putaway_tasks
       SET status = 'completed', completed_by = $1, completed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [userId, body.putaway_task_id]
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPendingPutaway(userId: string) {
  const { rows } = await pool.query(
    `SELECT pt.id AS grn_log_id,
            p.sku AS product_sku, p.name AS product_name,
            gl.qty_received::float AS qty_received,
            gl.lot_number, pt.status AS current_status,
            pt.from_bin_id
     FROM putaway_tasks pt
     JOIN grn_logs gl ON gl.id = pt.grn_log_id
     JOIN products p  ON p.id  = gl.product_id
     WHERE pt.status = 'pending' AND pt.assigned_to = $1
     ORDER BY pt.created_at`,
    [userId]
  );
  return rows;
}

export async function confirmPutawayFreeForm(
  body: { grn_log_id: string; bin_id: string },
  userId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [task] } = await client.query(
      `SELECT pt.*, gl.lot_number
       FROM putaway_tasks pt
       JOIN grn_logs gl ON gl.id = pt.grn_log_id
       WHERE pt.id = $1 FOR UPDATE`,
      [body.grn_log_id]
    );
    if (!task) throw new ServiceError('NOT_FOUND', 'Putaway task not found', 404);
    if (task.status === 'completed') throw new ServiceError('INVALID_STATUS', 'Task already completed', 409);

    // Move inventory: reduce from staging bin, add to chosen bin
    await client.query(
      `UPDATE inventory SET qty_on_hand = qty_on_hand - $1, updated_at = NOW()
       WHERE product_id = $2 AND bin_id = $3 AND lot_number IS NOT DISTINCT FROM $4`,
      [task.qty, task.product_id, task.from_bin_id, task.lot_number ?? null]
    );

    const { rows: existing } = await client.query(
      `SELECT qty_on_hand FROM inventory
       WHERE product_id = $1 AND bin_id = $2 AND lot_number IS NOT DISTINCT FROM $3 FOR UPDATE`,
      [task.product_id, body.bin_id, task.lot_number ?? null]
    );
    const newQty = toFloat(existing[0]?.qty_on_hand) + toFloat(task.qty);

    await client.query(
      `INSERT INTO inventory (product_id, bin_id, qty_on_hand, lot_number, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ON CONSTRAINT inventory_unique
       DO UPDATE SET qty_on_hand = $3, updated_at = NOW()`,
      [task.product_id, body.bin_id, newQty, task.lot_number ?? null]
    );

    const { rows: [updated] } = await client.query(
      `UPDATE putaway_tasks
       SET status = 'completed', completed_by = $1, completed_at = NOW(), to_bin_id = $2
       WHERE id = $3 RETURNING *`,
      [userId, body.bin_id, body.grn_log_id]
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Check Tasks ──────────────────────────────────────────────────────────────

export async function generateCheckTasks(body: GenerateCheckTasksBody, _userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(
      `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [body.so_id]
    );
    if (!so) throw new ServiceError('NOT_FOUND', 'Sales order not found', 404);
    if (so.status !== 'packed') {
      throw new ServiceError('INVALID_STATUS', `SO must be 'packed'. Current: ${so.status as string}`, 400);
    }

    const { rows: existing } = await client.query(
      `SELECT id FROM check_tasks WHERE so_id = $1 LIMIT 1`,
      [body.so_id]
    );
    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE', 'Check tasks already generated for this SO', 409);
    }

    const { rows: soLines } = await client.query(
      `SELECT sol.id, sol.product_id, sol.qty_ordered FROM so_lines sol WHERE sol.so_id = $1`,
      [body.so_id]
    );

    const tasks = [];
    for (const line of soLines) {
      const { rows: [task] } = await client.query(
        `INSERT INTO check_tasks (so_id, so_line_id, product_id, qty_expected, assigned_to)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [body.so_id, line.id, line.product_id, Math.round(toFloat(line.qty_ordered)), body.assigned_to ?? null]
      );
      tasks.push(task);
    }

    await client.query(
      `UPDATE sales_orders SET status = 'checking', updated_at = NOW() WHERE id = $1`,
      [body.so_id]
    );

    await client.query('COMMIT');
    return tasks;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCheckTasks(filters: {
  so_id?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.so_id) {
    params.push(filters.so_id);
    conditions.push(`ct.so_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`ct.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const { rows } = await pool.query(
    `SELECT ct.*,
            p.sku AS product_sku, p.name AS product_name,
            so.so_number, so.customer_name,
            u.full_name AS checker_name
     FROM check_tasks ct
     JOIN products p     ON ct.product_id = p.id
     JOIN sales_orders so ON ct.so_id = so.id
     LEFT JOIN users u   ON ct.checked_by = u.id
     ${where}
     ORDER BY ct.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );
  return rows;
}

export async function getMyCheckTasks(userId: string) {
  const { rows } = await pool.query(
    `SELECT ct.*,
            p.sku AS product_sku, p.name AS product_name,
            so.so_number, so.customer_name
     FROM check_tasks ct
     JOIN products p      ON ct.product_id = p.id
     JOIN sales_orders so ON ct.so_id      = so.id
     WHERE ct.assigned_to = $1 AND ct.status = 'pending'
     ORDER BY ct.created_at`,
    [userId]
  );
  return rows;
}

export async function confirmCheckTask(body: ConfirmCheckBody, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [task] } = await client.query(
      `SELECT * FROM check_tasks WHERE id = $1 FOR UPDATE`,
      [body.check_task_id]
    );
    if (!task) throw new ServiceError('NOT_FOUND', 'Check task not found', 404);
    if (task.status !== 'pending') {
      throw new ServiceError('INVALID_STATUS', 'Task already processed', 409);
    }

    const { rows: [updated] } = await client.query(
      `UPDATE check_tasks
       SET qty_checked = $1, status = 'passed', checked_by = $2, checked_at = NOW()
       WHERE id = $3 RETURNING *`,
      [body.qty_checked, userId, body.check_task_id]
    );

    // Auto-complete SO if all tasks passed and none failed
    const { rows: [counts] } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
         COUNT(*) FILTER (WHERE status = 'failed')  AS failed_count
       FROM check_tasks WHERE so_id = $1`,
      [task.so_id]
    );
    if (
      parseInt(counts.pending_count as string) === 0 &&
      parseInt(counts.failed_count  as string) === 0
    ) {
      await client.query(
        `UPDATE sales_orders SET status = 'checked', updated_at = NOW() WHERE id = $1`,
        [task.so_id]
      );
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function failCheckTask(body: FailCheckBody, userId: string) {
  const { rows: [task] } = await pool.query(
    `UPDATE check_tasks
     SET status = 'failed', checked_by = $1, checked_at = NOW(), notes = $2
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [userId, body.notes, body.check_task_id]
  );
  if (!task) {
    const { rows: check } = await pool.query(`SELECT status FROM check_tasks WHERE id = $1`, [body.check_task_id]);
    if (!check[0]) throw new ServiceError('NOT_FOUND', 'Check task not found', 404);
    throw new ServiceError('INVALID_STATUS', 'Task already processed', 409);
  }
  return task;
}

export async function getCheckTasksGrouped(userId: string) {
  const { rows } = await pool.query(
    `SELECT
       so.id,
       so.so_number,
       so.customer_name,
       so.required_date,
       CASE
         WHEN COUNT(*) FILTER (WHERE ct.status = 'pending') > 0 THEN 'pending'
         WHEN COUNT(*) FILTER (WHERE ct.status = 'failed')  > 0 THEN 'failed'
         ELSE 'passed'
       END AS status,
       COALESCE(
         json_agg(json_build_object(
           'id',           ct.id,
           'product_sku',  p.sku,
           'product_name', p.name,
           'qty_ordered',  COALESCE(sol.qty_ordered, ct.qty_expected),
           'qty_picked',   ct.qty_expected
         ) ORDER BY ct.created_at),
         '[]'::json
       ) AS lines,
       MAX(ct.notes) AS notes
     FROM check_tasks ct
     JOIN sales_orders so ON so.id = ct.so_id
     JOIN products p      ON p.id  = ct.product_id
     LEFT JOIN so_lines sol ON sol.id = ct.so_line_id
     WHERE ct.assigned_to = $1
     GROUP BY so.id, so.so_number, so.customer_name, so.required_date
     ORDER BY MAX(ct.created_at) DESC`,
    [userId]
  );
  return rows;
}

export async function completeSOCheckTasks(
  soId: string,
  passed: boolean,
  notes: string | undefined,
  userId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tasks } = await client.query(
      `SELECT id FROM check_tasks WHERE so_id = $1 AND status = 'pending'`,
      [soId]
    );
    if (tasks.length === 0) {
      const { rows: any } = await client.query(`SELECT id FROM check_tasks WHERE so_id = $1 LIMIT 1`, [soId]);
      if (any.length === 0) throw new ServiceError('NOT_FOUND', 'No check tasks found for this SO', 404);
      throw new ServiceError('INVALID_STATUS', 'All tasks already processed', 409);
    }

    const newStatus = passed ? 'passed' : 'failed';
    await client.query(
      `UPDATE check_tasks
       SET status = $1, checked_by = $2, checked_at = NOW(), notes = COALESCE($3, notes)
       WHERE so_id = $4 AND status = 'pending'`,
      [newStatus, userId, notes ?? null, soId]
    );

    const soStatus = passed ? 'checked' : 'picking';
    await client.query(
      `UPDATE sales_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [soStatus, soId]
    );

    await client.query('COMMIT');
    return { so_id: soId, passed, so_status: soStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Sales Invoice ────────────────────────────────────────────────────────────

export async function generateInvoice(body: GenerateInvoiceBody, createdBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [so] } = await client.query(
      `SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [body.so_id]
    );
    if (!so) throw new ServiceError('NOT_FOUND', 'Sales order not found', 404);
    if (so.status !== 'checked') {
      throw new ServiceError('INVALID_STATUS', `SO must be 'checked'. Current: ${so.status as string}`, 400);
    }

    const { rows: existing } = await client.query(
      `SELECT id FROM sales_invoices WHERE so_id = $1`,
      [body.so_id]
    );
    if (existing.length > 0) throw new ServiceError('DUPLICATE', 'Invoice already exists for this SO', 409);

    const year = new Date().getFullYear();
    const { rows: [{ count }] } = await client.query(
      `SELECT COUNT(*) FROM sales_invoices WHERE si_number LIKE $1`,
      [`SI-${year}-%`]
    );
    const siNumber = `SI-${year}-${String(parseInt(count as string) + 1).padStart(3, '0')}`;

    const { rows: [invoice] } = await client.query(
      `INSERT INTO sales_invoices (si_number, so_id, customer_name, status, issued_at, created_by)
       VALUES ($1, $2, $3, 'issued', NOW(), $4) RETURNING *`,
      [siNumber, body.so_id, so.customer_name, createdBy]
    );

    const { rows: soLines } = await client.query(
      `SELECT sol.product_id, sol.qty_ordered, p.sku, p.name, p.uom
       FROM so_lines sol JOIN products p ON sol.product_id = p.id
       WHERE sol.so_id = $1`,
      [body.so_id]
    );

    const priceMap = new Map<string, number>(
      (body.unit_prices ?? []).map(({ product_id, unit_price }) => [product_id, unit_price])
    );

    const lines = [];
    for (const line of soLines) {
      const unitPrice = priceMap.get(line.product_id as string) ?? 0;
      const lineTotal = unitPrice * toFloat(line.qty_ordered);
      const { rows: [siLine] } = await client.query(
        `INSERT INTO si_lines (si_id, product_id, product_sku, product_name, uom, qty, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [invoice.id, line.product_id, line.sku, line.name, line.uom, Math.round(toFloat(line.qty_ordered)), unitPrice, lineTotal]
      );
      lines.push(siLine);
    }

    const total = lines.reduce((s, l) => s + toFloat(l.line_total), 0);
    await client.query(
      `UPDATE sales_invoices
       SET total_amount = $1, balance_due = $1, payment_status = 'unpaid'
       WHERE id = $2`,
      [total, invoice.id]
    );

    await client.query(
      `UPDATE sales_orders SET status = 'invoiced', updated_at = NOW() WHERE id = $1`,
      [body.so_id]
    );

    await client.query('COMMIT');
    return { ...invoice, lines, total_amount: total };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getInvoices(filters: { status?: string; page: number; limit: number }) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`si.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const { rows } = await pool.query(
    `SELECT si.*, so.so_number
     FROM sales_invoices si
     JOIN sales_orders so ON si.so_id = so.id
     ${where}
     ORDER BY si.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );
  return rows;
}

export async function getInvoiceById(id: string) {
  const { rows: [invoice] } = await pool.query(
    `SELECT si.*, so.so_number, so.required_date
     FROM sales_invoices si
     JOIN sales_orders so ON si.so_id = so.id
     WHERE si.id = $1`,
    [id]
  );
  if (!invoice) return null;

  const { rows: lines } = await pool.query(
    `SELECT *, unit_price::float, line_total::float FROM si_lines WHERE si_id = $1 ORDER BY created_at`,
    [id]
  );

  const total_amount = lines.reduce((s, l) => s + toFloat(l.line_total), 0);
  return { ...invoice, lines, total_amount };
}

// ─── Barcode Data ─────────────────────────────────────────────────────────────

export async function getBinBarcodeData(binId: string) {
  const { rows: [bin] } = await pool.query(
    `SELECT bl.id, bl.aisle, bl.bay, bl.level, bl.type, w.name AS warehouse_name
     FROM bin_locations bl
     JOIN warehouses w ON bl.warehouse_id = w.id
     WHERE bl.id = $1`,
    [binId]
  );
  if (!bin) return null;
  return {
    type: 'bin',
    id: bin.id,
    barcode_value: bin.id,
    label: `${bin.aisle}-${bin.bay}-${bin.level}`,
    display: `${bin.warehouse_name} · Aisle ${bin.aisle} · Bay ${bin.bay} · Level ${bin.level} (${bin.type})`,
  };
}

export async function getProductBarcodeData(productId: string) {
  const { rows: [product] } = await pool.query(
    `SELECT id, sku, name, uom FROM products WHERE id = $1`,
    [productId]
  );
  if (!product) return null;
  return {
    type: 'product',
    id: product.id,
    barcode_value: product.sku,
    label: product.sku,
    display: `${product.name} (${product.uom})`,
  };
}
