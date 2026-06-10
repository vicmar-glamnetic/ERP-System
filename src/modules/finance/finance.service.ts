import { pool } from '../../db/client';
import { ServiceError } from '../auth/auth.service';
import {
  CreateBranchBody,
  CreateSupplierInvoiceBody,
  RecordAPPaymentBody,
  RecordARPaymentBody,
} from './finance.types';

function toFloat(val: unknown): number {
  return parseFloat(String(val ?? '0'));
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function createBranch(body: CreateBranchBody) {
  const { rows: [existing] } = await pool.query(
    `SELECT id FROM branches WHERE code = $1`,
    [body.code]
  );
  if (existing) throw new ServiceError('DUPLICATE', `Branch code '${body.code}' already exists`, 409);

  const { rows: [branch] } = await pool.query(
    `INSERT INTO branches (code, name, address, contact_person, contact_number)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [body.code, body.name, body.address ?? null, body.contact_person ?? null, body.contact_number ?? null]
  );
  return branch;
}

export async function getBranches(filters: { status?: string; page: number; limit: number }) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const { rows } = await pool.query(
    `SELECT * FROM branches ${where}
     ORDER BY name
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );
  return rows;
}

export async function getBranchById(id: string) {
  const { rows: [branch] } = await pool.query(
    `SELECT b.*,
            COUNT(so.id) AS total_orders,
            COALESCE(SUM(si.total_amount), 0)::float  AS total_invoiced,
            COALESCE(SUM(si.amount_paid),  0)::float  AS total_paid,
            COALESCE(SUM(si.balance_due),  0)::float  AS total_outstanding
     FROM branches b
     LEFT JOIN sales_orders so ON so.branch_id = b.id
     LEFT JOIN sales_invoices si ON si.so_id = so.id
     WHERE b.id = $1
     GROUP BY b.id`,
    [id]
  );
  return branch ?? null;
}

// ─── AP: Supplier Invoices ────────────────────────────────────────────────────

export async function createSupplierInvoice(body: CreateSupplierInvoiceBody, createdBy: string) {
  const { rows: [po] } = await pool.query(
    `SELECT id, supplier_name, status FROM purchase_orders WHERE id = $1`,
    [body.po_id]
  );
  if (!po) throw new ServiceError('NOT_FOUND', 'Purchase order not found', 404);

  const { rows: existing } = await pool.query(
    `SELECT id FROM supplier_invoices WHERE po_id = $1`,
    [body.po_id]
  );
  if (existing.length > 0) throw new ServiceError('DUPLICATE', 'Supplier invoice already exists for this PO', 409);

  const year = new Date().getFullYear();
  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM supplier_invoices WHERE inv_number LIKE $1`,
    [`SINV-${year}-%`]
  );
  const invNumber = `SINV-${year}-${String(parseInt(count as string) + 1).padStart(3, '0')}`;

  const { rows: [invoice] } = await pool.query(
    `INSERT INTO supplier_invoices
       (inv_number, po_id, supplier_name, total_amount, balance_due, due_date, notes, created_by)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING *`,
    [invNumber, body.po_id, po.supplier_name, body.total_amount, body.due_date ?? null, body.notes ?? null, createdBy]
  );
  return invoice;
}

export async function getSupplierInvoices(filters: {
  payment_status?: string;
  po_id?: string;
  page: number;
  limit: number;
}) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.payment_status) {
    params.push(filters.payment_status);
    conditions.push(`si.payment_status = $${params.length}`);
  }
  if (filters.po_id) {
    params.push(filters.po_id);
    conditions.push(`si.po_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const { rows } = await pool.query(
    `SELECT si.*, po.po_number
     FROM supplier_invoices si
     JOIN purchase_orders po ON si.po_id = po.id
     ${where}
     ORDER BY si.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );
  return rows.map((r) => ({
    ...r,
    total_amount: toFloat(r.total_amount),
    amount_paid:  toFloat(r.amount_paid),
    balance_due:  toFloat(r.balance_due),
  }));
}

export async function getSupplierInvoiceById(id: string) {
  const { rows: [invoice] } = await pool.query(
    `SELECT si.*, po.po_number
     FROM supplier_invoices si
     LEFT JOIN purchase_orders po ON si.po_id = po.id
     WHERE si.id = $1`,
    [id]
  );
  if (!invoice) return null;

  const { rows: payments } = await pool.query(
    `SELECT * FROM ap_payments WHERE supplier_invoice_id = $1 ORDER BY payment_date`,
    [id]
  );

  return {
    ...invoice,
    total_amount: toFloat(invoice.total_amount),
    amount_paid:  toFloat(invoice.amount_paid),
    balance_due:  toFloat(invoice.balance_due),
    payments: payments.map((p) => ({ ...p, amount: toFloat(p.amount) })),
  };
}

export async function recordAPPayment(body: RecordAPPaymentBody, createdBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [inv] } = await client.query(
      `SELECT * FROM supplier_invoices WHERE id = $1 FOR UPDATE`,
      [body.supplier_invoice_id]
    );
    if (!inv) throw new ServiceError('NOT_FOUND', 'Supplier invoice not found', 404);
    if (inv.payment_status === 'paid') {
      throw new ServiceError('ALREADY_PAID', 'Supplier invoice is already fully paid', 409);
    }

    const newAmountPaid = toFloat(inv.amount_paid) + body.amount;
    if (newAmountPaid > toFloat(inv.total_amount)) {
      throw new ServiceError(
        'OVERPAYMENT',
        `Payment of ${body.amount} exceeds balance due ${toFloat(inv.balance_due)}`,
        400
      );
    }

    const newBalance = toFloat(inv.total_amount) - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    const { rows: [payment] } = await client.query(
      `INSERT INTO ap_payments
         (supplier_invoice_id, amount, payment_date, payment_method, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.supplier_invoice_id, body.amount, body.payment_date,
       body.payment_method ?? null, body.reference_no ?? null, body.notes ?? null, createdBy]
    );

    await client.query(
      `UPDATE supplier_invoices
       SET amount_paid = $1, balance_due = $2, payment_status = $3
       WHERE id = $4`,
      [newAmountPaid, newBalance, newStatus, body.supplier_invoice_id]
    );

    await client.query('COMMIT');
    return { ...payment, amount: toFloat(payment.amount) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAPSummary() {
  const { rows: [summary] } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE payment_status = 'unpaid')                                    AS unpaid_count,
       COUNT(*) FILTER (WHERE payment_status = 'partial')                                   AS partial_count,
       COUNT(*) FILTER (WHERE payment_status = 'paid')                                      AS paid_count,
       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid')         AS overdue_count,
       COALESCE(SUM(total_amount), 0)::float                                                AS total_invoiced,
       COALESCE(SUM(amount_paid),  0)::float                                                AS total_paid,
       COALESCE(SUM(balance_due),  0)::float                                                AS total_outstanding,
       COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid'), 0)::float AS overdue_amount
     FROM supplier_invoices`
  );
  return summary;
}

// ─── AR: Sales Invoices + Payments ───────────────────────────────────────────

export async function getARInvoices(filters: {
  payment_status?: string;
  branch_id?: string;
  page: number;
  limit: number;
}) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.payment_status) {
    params.push(filters.payment_status);
    conditions.push(`si.payment_status = $${params.length}`);
  }
  if (filters.branch_id) {
    params.push(filters.branch_id);
    conditions.push(`so.branch_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.limit;

  const { rows } = await pool.query(
    `SELECT si.*,
            so.so_number, so.branch_id,
            b.name AS branch_name
     FROM sales_invoices si
     JOIN sales_orders so ON si.so_id = so.id
     LEFT JOIN branches b ON so.branch_id = b.id
     ${where}
     ORDER BY si.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );
  return rows.map((r) => ({
    ...r,
    total_amount: toFloat(r.total_amount),
    amount_paid:  toFloat(r.amount_paid),
    balance_due:  toFloat(r.balance_due),
  }));
}

export async function getARInvoiceById(id: string) {
  const { rows: [invoice] } = await pool.query(
    `SELECT si.*,
            so.so_number, so.branch_id, so.required_date,
            b.name AS branch_name
     FROM sales_invoices si
     JOIN sales_orders so ON si.so_id = so.id
     LEFT JOIN branches b ON so.branch_id = b.id
     WHERE si.id = $1`,
    [id]
  );
  if (!invoice) return null;

  const { rows: lines } = await pool.query(
    `SELECT *, unit_price::float, line_total::float FROM si_lines WHERE si_id = $1 ORDER BY created_at`,
    [id]
  );
  const { rows: payments } = await pool.query(
    `SELECT * FROM ar_payments WHERE si_id = $1 ORDER BY payment_date`,
    [id]
  );

  return {
    ...invoice,
    total_amount: toFloat(invoice.total_amount),
    amount_paid:  toFloat(invoice.amount_paid),
    balance_due:  toFloat(invoice.balance_due),
    lines,
    payments: payments.map((p) => ({ ...p, amount: toFloat(p.amount) })),
  };
}

export async function recordARPayment(body: RecordARPaymentBody, createdBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [inv] } = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE`,
      [body.si_id]
    );
    if (!inv) throw new ServiceError('NOT_FOUND', 'Sales invoice not found', 404);
    if (inv.payment_status === 'paid') {
      throw new ServiceError('ALREADY_PAID', 'Invoice is already fully paid', 409);
    }

    const currentTotal = toFloat(inv.total_amount);
    if (currentTotal === 0) {
      throw new ServiceError('INVALID', 'Invoice has no total amount. Generate invoice lines first.', 400);
    }

    const newAmountPaid = toFloat(inv.amount_paid) + body.amount;
    if (newAmountPaid > currentTotal) {
      throw new ServiceError(
        'OVERPAYMENT',
        `Payment of ${body.amount} exceeds balance due ${toFloat(inv.balance_due)}`,
        400
      );
    }

    const newBalance = currentTotal - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    const { rows: [payment] } = await client.query(
      `INSERT INTO ar_payments
         (si_id, amount, payment_date, payment_method, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.si_id, body.amount, body.payment_date,
       body.payment_method ?? null, body.reference_no ?? null, body.notes ?? null, createdBy]
    );

    await client.query(
      `UPDATE sales_invoices
       SET amount_paid = $1, balance_due = $2, payment_status = $3
       WHERE id = $4`,
      [newAmountPaid, newBalance, newStatus, body.si_id]
    );

    await client.query('COMMIT');
    return { ...payment, amount: toFloat(payment.amount) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getARSummary() {
  const { rows: [summary] } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE payment_status = 'unpaid')                                              AS unpaid_count,
       COUNT(*) FILTER (WHERE payment_status = 'partial')                                             AS partial_count,
       COUNT(*) FILTER (WHERE payment_status = 'paid')                                                AS paid_count,
       COUNT(*) FILTER (WHERE payment_status != 'paid' AND issued_at < NOW() - INTERVAL '30 days')   AS overdue_count,
       COALESCE(SUM(total_amount), 0)::float                                                          AS total_invoiced,
       COALESCE(SUM(amount_paid),  0)::float                                                          AS total_collected,
       COALESCE(SUM(balance_due),  0)::float                                                          AS total_outstanding
     FROM sales_invoices`
  );
  return summary;
}
