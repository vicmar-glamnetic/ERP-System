-- Branches (ordering entities)
CREATE TABLE IF NOT EXISTS branches (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(20) UNIQUE NOT NULL,
  name           VARCHAR(100) NOT NULL,
  address        TEXT,
  contact_person VARCHAR(100),
  contact_number VARCHAR(30),
  status         VARCHAR(20) DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Link SOs to originating branch
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- AR tracking columns on existing sales_invoices
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS total_amount   DECIMAL(14,2) DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS amount_paid    DECIMAL(14,2) DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS balance_due    DECIMAL(14,2) DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)   DEFAULT 'unpaid';

-- AR Payments: money received from branches/customers
CREATE TABLE IF NOT EXISTS ar_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  si_id          UUID NOT NULL REFERENCES sales_invoices(id),
  amount         DECIMAL(12,2) NOT NULL,
  payment_date   DATE NOT NULL,
  payment_method VARCHAR(30),
  reference_no   VARCHAR(50),
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Invoices (AP): what the company owes suppliers
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inv_number     VARCHAR(30) UNIQUE NOT NULL,
  po_id          UUID REFERENCES purchase_orders(id),
  supplier_name  VARCHAR(100) NOT NULL,
  total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(14,2) DEFAULT 0,
  balance_due    DECIMAL(14,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  due_date       DATE,
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- AP Payments: money paid out to suppliers
CREATE TABLE IF NOT EXISTS ap_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
  amount              DECIMAL(12,2) NOT NULL,
  payment_date        DATE NOT NULL,
  payment_method      VARCHAR(30),
  reference_no        VARCHAR(50),
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
