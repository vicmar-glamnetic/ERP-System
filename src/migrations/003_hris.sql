CREATE TABLE IF NOT EXISTS shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shift_date  DATE NOT NULL,
  zone        VARCHAR(50),
  clock_in    TIME,
  clock_out   TIME,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type  VARCHAR(10) NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);
