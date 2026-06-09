-- Bin location type: rack (default), staging, bulk
ALTER TABLE bin_locations ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'rack';

-- Putaway tasks: move items from staging bin to rack bin after receiving
CREATE TABLE IF NOT EXISTS putaway_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_log_id   UUID REFERENCES grn_logs(id),
  product_id   UUID REFERENCES products(id),
  qty          INT NOT NULL,
  from_bin_id  UUID REFERENCES bin_locations(id),
  to_bin_id    UUID REFERENCES bin_locations(id),
  status       VARCHAR(20) DEFAULT 'pending',
  assigned_to  UUID REFERENCES users(id),
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Check tasks: checker verifies picked items match the SO before invoicing
CREATE TABLE IF NOT EXISTS check_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id        UUID REFERENCES sales_orders(id),
  so_line_id   UUID REFERENCES so_lines(id),
  product_id   UUID REFERENCES products(id),
  qty_expected INT NOT NULL,
  qty_checked  INT DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending',
  assigned_to  UUID REFERENCES users(id),
  checked_by   UUID REFERENCES users(id),
  checked_at   TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Sales invoices generated after checking passes
CREATE TABLE IF NOT EXISTS sales_invoices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  si_number     VARCHAR(30) UNIQUE NOT NULL,
  so_id         UUID UNIQUE REFERENCES sales_orders(id),
  customer_name VARCHAR(100) NOT NULL,
  status        VARCHAR(20) DEFAULT 'issued',
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- SI line items
CREATE TABLE IF NOT EXISTS si_lines (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  si_id        UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  product_sku  VARCHAR(50),
  product_name VARCHAR(100),
  uom          VARCHAR(20),
  qty          INT NOT NULL,
  unit_price   DECIMAL(10,2) DEFAULT 0,
  line_total   DECIMAL(12,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
