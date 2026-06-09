import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { pool } from './client';

dotenv.config();

async function seed(): Promise<void> {
  // --- Users ---
  const { rows: userRows } = await pool.query('SELECT id FROM users LIMIT 1');
  if (userRows.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    await pool.query(
      `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['ADMIN-001', 'System Admin', 'admin@erp.local', passwordHash, 'system_admin', 'IT', 'active']
    );
    console.log('Admin user seeded.');
  } else {
    console.log('Users exist — skipping user seed.');
  }

  // --- Warehouses / Inventory ---
  const { rows: whRows } = await pool.query('SELECT id FROM warehouses LIMIT 1');
  if (whRows.length === 0) {
    const { rows: [warehouse] } = await pool.query(
      `INSERT INTO warehouses (code, name, location) VALUES ($1, $2, $3) RETURNING id`,
      ['WH-MAIN', 'Main Warehouse', 'Cebu City']
    );
    const warehouseId = warehouse.id as string;

    const binDefs = [
      ['A', '01', '01'], ['A', '01', '02'],
      ['A', '02', '01'], ['A', '02', '02'],
      ['B', '01', '01'], ['B', '01', '02'],
    ];
    const binIds: Record<string, string> = {};
    for (const [aisle, bay, level] of binDefs) {
      const { rows: [bin] } = await pool.query(
        `INSERT INTO bin_locations (warehouse_id, aisle, bay, level) VALUES ($1, $2, $3, $4) RETURNING id`,
        [warehouseId, aisle, bay, level]
      );
      binIds[`${aisle}-${bay}-${level}`] = bin.id as string;
    }

    const productDefs = [
      { sku: 'SKU-001', name: 'Bottled Water 500ml', category: 'Beverages', uom: 'pcs', reorder_point: 50 },
      { sku: 'SKU-002', name: 'Rice 5kg Bag',         category: 'Grains',    uom: 'bag', reorder_point: 20 },
      { sku: 'SKU-003', name: 'Canned Sardines 155g', category: 'Canned',    uom: 'pcs', reorder_point: 30 },
    ];
    const productIds: Record<string, string> = {};
    for (const p of productDefs) {
      const { rows: [product] } = await pool.query(
        `INSERT INTO products (sku, name, category, uom, reorder_point) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [p.sku, p.name, p.category, p.uom, p.reorder_point]
      );
      productIds[p.sku] = product.id as string;
    }

    const stockDefs = [
      { sku: 'SKU-001', bin: 'A-01-01', qty: 200 },
      { sku: 'SKU-002', bin: 'A-02-01', qty: 80  },
      { sku: 'SKU-003', bin: 'B-01-01', qty: 150 },
    ];
    for (const s of stockDefs) {
      await pool.query(
        `INSERT INTO inventory (product_id, bin_id, qty_on_hand) VALUES ($1, $2, $3)`,
        [productIds[s.sku], binIds[s.bin], s.qty]
      );
    }
    console.log('Inventory data seeded: 1 warehouse, 6 bins, 3 products, 3 stock entries.');
  } else {
    console.log('Warehouses exist — skipping inventory seed.');
  }

  // --- WMS ---
  const { rows: poRows } = await pool.query('SELECT id FROM purchase_orders LIMIT 1');
  if (poRows.length === 0) {
    const { rows: adminRows } = await pool.query(
      `SELECT id FROM users WHERE employee_code = 'ADMIN-001'`
    );
    const adminId = adminRows[0]?.id as string | undefined;

    const { rows: productRows } = await pool.query(
      `SELECT id, sku FROM products WHERE sku IN ('SKU-001', 'SKU-002', 'SKU-003')`
    );
    const productMap: Record<string, string> = {};
    for (const p of productRows) {
      productMap[p.sku as string] = p.id as string;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const { rows: [po] } = await pool.query(
      `INSERT INTO purchase_orders (po_number, supplier_name, status, expected_date, created_by)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
      ['PO-2026-001', 'ABC Distributors', tomorrow.toISOString().split('T')[0], adminId ?? null]
    );
    await pool.query(
      `INSERT INTO po_lines (po_id, product_id, qty_ordered) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [po.id, productMap['SKU-001'], 100, productMap['SKU-002'], 50]
    );

    const { rows: [so] } = await pool.query(
      `INSERT INTO sales_orders (so_number, customer_name, status, required_date, created_by)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
      ["SO-2026-001", "Juan's Sari-Sari Store", threeDaysLater.toISOString().split('T')[0], adminId ?? null]
    );
    await pool.query(
      `INSERT INTO so_lines (so_id, product_id, qty_ordered) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [so.id, productMap['SKU-001'], 30, productMap['SKU-003'], 20]
    );

    console.log('WMS data seeded: PO-2026-001, SO-2026-001 with lines.');
  } else {
    console.log('WMS data exists — skipping WMS seed.');
  }

  // --- Enhanced WMS: staging bins + checker user ---
  const { rows: stagingRows } = await pool.query(
    `SELECT id FROM bin_locations WHERE type = 'staging' LIMIT 1`
  );
  if (stagingRows.length === 0) {
    const { rows: [wh] } = await pool.query(`SELECT id FROM warehouses LIMIT 1`);
    if (wh) {
      await pool.query(
        `INSERT INTO bin_locations (warehouse_id, aisle, bay, level, type) VALUES
         ($1, 'S', '01', '01', 'staging'),
         ($1, 'S', '02', '01', 'staging')`,
        [wh.id]
      );
      console.log('Staging bins seeded: S-01-01, S-02-01.');
    }
  } else {
    console.log('Staging bins exist — skipping.');
  }

  const { rows: checkerRows } = await pool.query(
    `SELECT id FROM users WHERE employee_code = 'CHK-001'`
  );
  if (checkerRows.length === 0) {
    const checkerHash = await bcrypt.hash('Checker@1234', 12);
    await pool.query(
      `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['CHK-001', 'Carlos Reyes', 'checker@erp.local', checkerHash, 'checker', 'Warehouse', 'active']
    );
    console.log('Checker user seeded: CHK-001 / Checker@1234.');
  } else {
    console.log('Checker user exists — skipping.');
  }

  // --- TMS ---
  const { rows: vehicleRows } = await pool.query('SELECT id FROM vehicles LIMIT 1');
  if (vehicleRows.length === 0) {
    // Reset password for existing driver (created by HRIS seed) to known value
    const driverHash = await bcrypt.hash('Driver@1234', 12);
    const { rows: driverRows } = await pool.query(`SELECT id FROM users WHERE role = 'driver' LIMIT 1`);
    if (driverRows.length === 0) {
      await pool.query(
        `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['DRV-001', 'Maria Santos', 'maria@erp.local', driverHash, 'driver', 'Logistics', 'active']
      );
    } else {
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [driverHash, driverRows[0].id]);
    }

    // Create dispatcher user
    const dispHash = await bcrypt.hash('Disp@1234', 12);
    await pool.query(
      `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_code) DO NOTHING`,
      ['DISP-001', 'Ana Reyes', 'disp@erp.local', dispHash, 'dispatcher', 'Logistics', 'active']
    );

    await pool.query(
      `INSERT INTO vehicles (plate_number, type, fuel_capacity, status) VALUES
       ($1, $2, $3, 'available'), ($4, $5, $6, 'available')`,
      ['ABC-1234', 'van', 60.00, 'XYZ-5678', 'truck', 100.00]
    );
    console.log('TMS data seeded: 2 vehicles, driver password reset to Driver@1234, dispatcher DISP-001 (Disp@1234).');
  } else {
    console.log('Vehicles exist — skipping TMS seed.');
  }

  // --- Finance: branches + finance officer ---
  const { rows: branchRows } = await pool.query(`SELECT id FROM branches LIMIT 1`);
  if (branchRows.length === 0) {
    await pool.query(
      `INSERT INTO branches (code, name, address, contact_person, contact_number) VALUES
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10)`,
      [
        'BR-001', 'Cebu North Branch',   'A. Soriano Ave, Cebu City',    'Jose Cruz',   '0912-111-2222',
        'BR-002', 'Cebu South Branch',   'Tabunok, Talisay City, Cebu',  'Linda Gomez', '0917-333-4444',
      ]
    );
    console.log('Branches seeded: BR-001, BR-002.');
  } else {
    console.log('Branches exist — skipping.');
  }

  const { rows: finRows } = await pool.query(`SELECT id FROM users WHERE employee_code = 'FIN-001'`);
  if (finRows.length === 0) {
    const finHash = await bcrypt.hash('Finance@1234', 12);
    await pool.query(
      `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['FIN-001', 'Rosa Dela Cruz', 'finance@erp.local', finHash, 'finance_officer', 'Finance', 'active']
    );
    console.log('Finance officer seeded: FIN-001 / Finance@1234.');
  } else {
    console.log('Finance officer exists — skipping.');
  }

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
