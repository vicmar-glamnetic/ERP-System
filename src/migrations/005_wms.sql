CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number     VARCHAR(30) UNIQUE NOT NULL,
  supplier_name VARCHAR(100) NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending',
  expected_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_lines (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id        UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  qty_ordered  DECIMAL(10,2) NOT NULL,
  qty_received DECIMAL(10,2) DEFAULT 0,
  unit_cost    DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_number     VARCHAR(30) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending',
  required_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS so_lines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id       UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  qty_ordered DECIMAL(10,2) NOT NULL,
  qty_picked  DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pick_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id        UUID REFERENCES sales_orders(id),
  so_line_id   UUID REFERENCES so_lines(id),
  product_id   UUID REFERENCES products(id),
  bin_id       UUID REFERENCES bin_locations(id),
  assigned_to  UUID REFERENCES users(id),
  qty_to_pick  DECIMAL(10,2) NOT NULL,
  qty_picked   DECIMAL(10,2) DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grn_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id        UUID REFERENCES purchase_orders(id),
  po_line_id   UUID REFERENCES po_lines(id),
  product_id   UUID REFERENCES products(id),
  bin_id       UUID REFERENCES bin_locations(id),
  qty_received DECIMAL(10,2) NOT NULL,
  lot_number   VARCHAR(50),
  expiry_date  DATE,
  received_by  UUID REFERENCES users(id),
  received_at  TIMESTAMPTZ DEFAULT NOW()
);
