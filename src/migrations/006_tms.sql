CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number  VARCHAR(20) UNIQUE NOT NULL,
  type          VARCHAR(30) NOT NULL,
  fuel_capacity DECIMAL(6,2),
  status        VARCHAR(20) DEFAULT 'available',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_date   DATE NOT NULL,
  vehicle_id   UUID REFERENCES vehicles(id),
  driver_id    UUID REFERENCES users(id),
  status       VARCHAR(20) DEFAULT 'pending',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_stops (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id        UUID REFERENCES routes(id) ON DELETE CASCADE,
  so_id           UUID REFERENCES sales_orders(id),
  stop_sequence   INT NOT NULL,
  address         TEXT NOT NULL,
  recipient_name  VARCHAR(100),
  recipient_phone VARCHAR(20),
  status          VARCHAR(20) DEFAULT 'pending',
  pod_photo_url   TEXT,
  signature_url   TEXT,
  notes           TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id  UUID REFERENCES routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  latitude  DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  speed_kmh DECIMAL(5,1),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    UUID REFERENCES routes(id),
  driver_id   UUID REFERENCES users(id),
  vehicle_id  UUID REFERENCES vehicles(id),
  liters      DECIMAL(6,2) NOT NULL,
  distance_km DECIMAL(8,2) NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);
