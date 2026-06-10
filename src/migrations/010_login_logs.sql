CREATE TABLE IF NOT EXISTS login_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ DEFAULT NOW(),
  device_type  VARCHAR(20) DEFAULT 'web',
  ip_address   VARCHAR(45)
);
