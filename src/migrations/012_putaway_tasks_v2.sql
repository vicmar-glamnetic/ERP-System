-- Add missing columns to putaway_tasks for assignment-based flow
ALTER TABLE putaway_tasks
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS lot_number   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES users(id);
