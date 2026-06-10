ALTER TABLE shifts RENAME COLUMN clock_in  TO start_time;
ALTER TABLE shifts RENAME COLUMN clock_out TO end_time;
ALTER TABLE shifts RENAME COLUMN zone      TO shift_type;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
