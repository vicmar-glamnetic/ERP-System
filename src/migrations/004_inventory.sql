CREATE TABLE IF NOT EXISTS warehouses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  location   TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bin_locations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  aisle        VARCHAR(10) NOT NULL,
  bay          VARCHAR(10) NOT NULL,
  level        VARCHAR(10) NOT NULL,
  capacity     INT DEFAULT 100,
  is_active    BOOLEAN DEFAULT true,
  UNIQUE(warehouse_id, aisle, bay, level)
);

CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku           VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  category      VARCHAR(50),
  uom           VARCHAR(20) NOT NULL,
  reorder_point DECIMAL(10,2) DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID REFERENCES products(id),
  bin_id       UUID REFERENCES bin_locations(id),
  qty_on_hand  DECIMAL(10,2) DEFAULT 0,
  qty_reserved DECIMAL(10,2) DEFAULT 0,
  lot_number   VARCHAR(50),
  expiry_date  DATE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT inventory_unique UNIQUE NULLS NOT DISTINCT (product_id, bin_id, lot_number)
);
