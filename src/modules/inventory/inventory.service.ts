import { pool } from '../../db/client';
import { ServiceError } from '../auth/auth.service';
import {
  CreateWarehouseBody,
  CreateBinBody,
  CreateProductBody,
  UpdateProductBody,
  StockAdjustmentBody,
  WarehouseRow,
  BinLocationRow,
  ProductRow,
  InventoryRow,
  InventoryWithDetails,
} from './inventory.types';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export async function getWarehouses(): Promise<WarehouseRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM warehouses WHERE is_active = true ORDER BY name`
  );
  return rows as WarehouseRow[];
}

export async function createWarehouse(body: CreateWarehouseBody): Promise<WarehouseRow> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO warehouses (code, name, location) VALUES ($1, $2, $3) RETURNING *`,
      [body.code, body.name, body.location ?? null]
    );
    return rows[0] as WarehouseRow;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceError('DUPLICATE_ENTRY', 'Warehouse code already exists', 409);
    }
    throw err;
  }
}

// ─── Bins ─────────────────────────────────────────────────────────────────────

export async function getBins(warehouseId: string): Promise<BinLocationRow[]> {
  const { rows } = await pool.query(
    `SELECT bl.*,
            COALESCE(SUM(i.qty_on_hand), 0)::float AS qty_total
     FROM bin_locations bl
     LEFT JOIN inventory i ON bl.id = i.bin_id
     WHERE bl.warehouse_id = $1
     GROUP BY bl.id
     ORDER BY bl.aisle, bl.bay, bl.level`,
    [warehouseId]
  );
  return rows as BinLocationRow[];
}

export async function createBin(body: CreateBinBody): Promise<BinLocationRow> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO bin_locations (warehouse_id, aisle, bay, level, capacity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.warehouse_id, body.aisle, body.bay, body.level, body.capacity ?? 100]
    );
    return rows[0] as BinLocationRow;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceError('DUPLICATE_ENTRY', 'Bin location already exists in this warehouse', 409);
    }
    throw err;
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(filters: {
  category?: string;
  is_active?: string;
  page: number;
  limit: number;
}): Promise<{ data: ProductRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`category = $${params.length}`);
  }

  if (filters.is_active !== undefined) {
    params.push(filters.is_active === 'true');
    conditions.push(`is_active = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params);
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const { rows } = await pool.query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );

  return { data: rows as ProductRow[], total };
}

export async function getProductBySku(sku: string): Promise<ProductRow | null> {
  const { rows } = await pool.query(`SELECT * FROM products WHERE sku = $1`, [sku]);
  return (rows[0] as ProductRow) ?? null;
}

export async function createProduct(body: CreateProductBody): Promise<ProductRow> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (sku, name, description, category, uom, reorder_point)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.sku,
        body.name,
        body.description ?? null,
        body.category ?? null,
        body.uom,
        body.reorder_point ?? 0,
      ]
    );
    return rows[0] as ProductRow;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceError('DUPLICATE_ENTRY', 'SKU already exists', 409);
    }
    throw err;
  }
}

export async function updateProduct(
  id: string,
  body: UpdateProductBody
): Promise<ProductRow | null> {
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
    return (rows[0] as ProductRow) ?? null;
  }

  const sets = entries.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
  const values = entries.map(([, v]) => v);

  const { rows } = await pool.query(
    `UPDATE products SET ${sets}, updated_at = NOW()
     WHERE id = $${entries.length + 1} RETURNING *`,
    [...values, id]
  );

  return (rows[0] as ProductRow) ?? null;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(filters: {
  warehouse_id?: string;
  product_id?: string;
  low_stock?: boolean;
  page: number;
  limit: number;
}): Promise<{ data: InventoryWithDetails[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.warehouse_id) {
    params.push(filters.warehouse_id);
    conditions.push(`bl.warehouse_id = $${params.length}`);
  }

  if (filters.product_id) {
    params.push(filters.product_id);
    conditions.push(`inv.product_id = $${params.length}`);
  }

  if (filters.low_stock) {
    conditions.push(`inv.qty_on_hand <= p.reorder_point`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseQuery = `
    FROM inventory inv
    JOIN products p       ON inv.product_id = p.id
    JOIN bin_locations bl ON inv.bin_id = bl.id
    JOIN warehouses w     ON bl.warehouse_id = w.id
    ${where}
  `;

  const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const { rows } = await pool.query(
    `SELECT
       inv.id,
       inv.product_id,
       inv.bin_id,
       p.sku,
       p.name                                       AS product_name,
       w.name                                       AS warehouse_name,
       bl.aisle,
       bl.bay,
       bl.level,
       inv.qty_on_hand::float                       AS qty_on_hand,
       inv.qty_reserved::float                      AS qty_reserved,
       (inv.qty_on_hand - inv.qty_reserved)::float  AS qty_available,
       inv.lot_number,
       inv.expiry_date,
       (inv.qty_on_hand <= p.reorder_point)         AS is_low_stock,
       inv.updated_at
     ${baseQuery}
     ORDER BY w.name, bl.aisle, bl.bay, bl.level
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );

  return { data: rows as InventoryWithDetails[], total };
}

export async function adjustStock(
  body: StockAdjustmentBody,
  _adjustedBy: string
): Promise<InventoryRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT qty_on_hand FROM inventory
       WHERE product_id = $1
         AND bin_id = $2
         AND lot_number IS NOT DISTINCT FROM $3
       FOR UPDATE`,
      [body.product_id, body.bin_id, body.lot_number ?? null]
    );

    const currentQty = parseFloat((rows[0]?.qty_on_hand as string) ?? '0');
    const newQty = currentQty + body.qty;

    if (newQty < 0) {
      throw new ServiceError(
        'INVALID_QUANTITY',
        `Insufficient stock. Current: ${currentQty}, Adjustment: ${body.qty}`,
        400
      );
    }

    const result = await client.query(
      `INSERT INTO inventory (product_id, bin_id, qty_on_hand, lot_number, expiry_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ON CONSTRAINT inventory_unique
       DO UPDATE SET qty_on_hand = $3, updated_at = NOW()
       RETURNING *`,
      [
        body.product_id,
        body.bin_id,
        newQty,
        body.lot_number ?? null,
        body.expiry_date ?? null,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0] as InventoryRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
