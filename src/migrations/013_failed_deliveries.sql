-- Add failed delivery tracking columns to delivery_stops
ALTER TABLE delivery_stops
  ADD COLUMN IF NOT EXISTS failure_reason          TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_date         DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_to_stop_id  UUID REFERENCES delivery_stops(id),
  ADD COLUMN IF NOT EXISTS resolution              VARCHAR(20) DEFAULT NULL;

-- Log table for failed deliveries and dispatcher resolution
CREATE TABLE IF NOT EXISTS failed_delivery_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stop_id         UUID REFERENCES delivery_stops(id),
  route_id        UUID REFERENCES routes(id),
  so_id           UUID REFERENCES sales_orders(id),
  driver_id       UUID REFERENCES users(id),
  failure_reason  TEXT NOT NULL,
  resolution      VARCHAR(20),
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
