-- Add clock_in / clock_out timestamps to shifts for late-detection
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS clock_in  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_minutes INT;

-- status default was 'present'; keep it — mark-absent job will flip unclocked shifts to 'absent'
-- Fix: status column already exists (migration 011 added it), no change needed

-- Index for fast absent-detection query
CREATE INDEX IF NOT EXISTS idx_shifts_date_status
  ON shifts (shift_date, status)
  WHERE clock_in IS NULL;
