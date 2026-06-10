import bcrypt from 'bcrypt';
import { pool } from '../../db/client';
import { ServiceError } from '../auth/auth.service';
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  ChangePasswordBody,
  CreateShiftBody,
  EmployeeRow,
} from './hris.types';

const EMPLOYEE_COLUMNS =
  'id, employee_code, full_name, email, role, department, manager_id, status, created_at';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export async function getAllEmployees(filters: {
  status?: string;
  department?: string;
  role?: string;
  page: number;
  limit: number;
}): Promise<{ data: EmployeeRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`u.status = $${params.length}`);
  }

  if (filters.department) {
    params.push(filters.department);
    conditions.push(`u.department = $${params.length}`);
  }

  if (filters.role) {
    params.push(filters.role);
    conditions.push(`u.role = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const dataResult = await pool.query(
    `SELECT u.${EMPLOYEE_COLUMNS.split(', ').join(', u.')},
            ll.logged_in_at AS last_login,
            ll.device_type  AS last_device
     FROM users u
     LEFT JOIN LATERAL (
       SELECT logged_in_at, device_type FROM login_logs
       WHERE user_id = u.id ORDER BY logged_in_at DESC LIMIT 1
     ) ll ON true
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, offset]
  );

  return { data: dataResult.rows as EmployeeRow[], total };
}

export async function getEmployeeById(id: string): Promise<EmployeeRow | null> {
  const { rows } = await pool.query(
    `SELECT ${EMPLOYEE_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return (rows[0] as EmployeeRow) ?? null;
}

export async function createEmployee(body: CreateEmployeeBody): Promise<EmployeeRow> {
  const rounds = parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10);
  const passwordHash = await bcrypt.hash(body.password, rounds);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (employee_code, full_name, email, password_hash, role, department, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${EMPLOYEE_COLUMNS}`,
      [
        body.employee_code,
        body.full_name,
        body.email,
        passwordHash,
        body.role,
        body.department ?? null,
        body.manager_id ?? null,
      ]
    );
    return rows[0] as EmployeeRow;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ServiceError('DUPLICATE_ENTRY', 'Employee code or email already exists', 409);
    }
    throw err;
  }
}

export async function updateEmployee(
  id: string,
  body: UpdateEmployeeBody
): Promise<EmployeeRow | null> {
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    return getEmployeeById(id);
  }

  const sets = entries.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
  const values = entries.map(([, v]) => v);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets}, updated_at = NOW()
     WHERE id = $${entries.length + 1}
     RETURNING ${EMPLOYEE_COLUMNS}`,
    [...values, id]
  );

  return (rows[0] as EmployeeRow) ?? null;
}

export async function changePassword(
  id: string,
  body: ChangePasswordBody,
  requesterId: string,
  requesterRole: string
): Promise<void> {
  if (requesterRole !== 'system_admin' && id !== requesterId) {
    throw new ServiceError('FORBIDDEN', 'You can only change your own password', 403);
  }

  if (requesterRole !== 'system_admin') {
    if (!body.current_password) {
      throw new ServiceError('INVALID_CREDENTIALS', 'Current password is required', 400);
    }

    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [id]
    );

    if (!rows[0]) {
      throw new ServiceError('NOT_FOUND', 'User not found', 404);
    }

    const valid = await bcrypt.compare(body.current_password, rows[0].password_hash as string);
    if (!valid) {
      throw new ServiceError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);
    }
  }

  const rounds = parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10);
  const hash = await bcrypt.hash(body.new_password, rounds);

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hash, id]
  );
}

export async function createShift(body: CreateShiftBody) {
  const { rows } = await pool.query(
    `INSERT INTO shifts (employee_id, shift_date, shift_type, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      body.employee_id,
      body.shift_date,
      body.shift_type ?? 'regular',
      body.start_time ?? null,
      body.end_time ?? null,
    ]
  );
  return rows[0];
}

export async function getShifts(filters: {
  employee_id?: string;
  date_from?: string;
  date_to?: string;
  department?: string;
  requesterId: string;
  requesterRole: string;
}) {
  const restricted = ['wh_operator', 'driver'];
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (restricted.includes(filters.requesterRole)) {
    params.push(filters.requesterId);
    conditions.push(`s.employee_id = $${params.length}`);
  } else {
    if (filters.employee_id) {
      params.push(filters.employee_id);
      conditions.push(`s.employee_id = $${params.length}`);
    }
    if (filters.department) {
      params.push(filters.department);
      conditions.push(`u.department = $${params.length}`);
    }
  }

  if (filters.date_from) {
    params.push(filters.date_from);
    conditions.push(`s.shift_date >= $${params.length}`);
  }

  if (filters.date_to) {
    params.push(filters.date_to);
    conditions.push(`s.shift_date <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.*, u.full_name, u.role AS employee_role
     FROM shifts s
     JOIN users u ON s.employee_id = u.id
     ${where}
     ORDER BY s.shift_date DESC, s.clock_in DESC NULLS LAST`,
    params
  );

  return rows;
}

const LATE_GRACE_MINUTES = 15;

export async function logAttendance(employeeId: string, eventType: 'clock_in' | 'clock_out') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [log] } = await client.query(
      `INSERT INTO attendance_logs (employee_id, event_type) VALUES ($1, $2) RETURNING *`,
      [employeeId, eventType]
    );

    // Update today's shift with clock_in / clock_out and compute status
    const { rows: [shift] } = await client.query(
      `SELECT * FROM shifts WHERE employee_id = $1 AND shift_date = CURRENT_DATE LIMIT 1`,
      [employeeId]
    );

    let updatedStatus: string | null = null;

    if (shift) {
      if (eventType === 'clock_in' && !shift.clock_in) {
        let status = 'present';
        let lateMinutes: number | null = null;

        if (shift.start_time) {
          const { rows: [{ diff_minutes }] } = await client.query(
            `SELECT EXTRACT(EPOCH FROM (NOW() - ($1::date + $2::time))) / 60 AS diff_minutes`,
            [shift.shift_date, shift.start_time]
          );
          lateMinutes = Math.round(diff_minutes);
          if (lateMinutes > LATE_GRACE_MINUTES) {
            status = 'late';
          }
        }

        await client.query(
          `UPDATE shifts SET clock_in = NOW(), status = $2, late_minutes = $3 WHERE id = $1`,
          [shift.id, status, lateMinutes]
        );
        updatedStatus = status;
      } else if (eventType === 'clock_out' && !shift.clock_out) {
        await client.query(
          `UPDATE shifts SET clock_out = NOW() WHERE id = $1`,
          [shift.id]
        );
        updatedStatus = shift.status;
      }
    }

    await client.query('COMMIT');
    return { ...log, shift_status: updatedStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function markAbsentShifts() {
  // Shifts today where start_time has passed (+ grace) and employee never clocked in
  const { rows } = await pool.query(
    `UPDATE shifts
     SET status = 'absent'
     WHERE shift_date = CURRENT_DATE
       AND status = 'present'
       AND clock_in IS NULL
       AND start_time IS NOT NULL
       AND (LOCALTIME - start_time) > INTERVAL '${LATE_GRACE_MINUTES} minutes'
     RETURNING id, employee_id, shift_date, status`
  );
  return rows;
}

export async function getAttendance(filters: {
  employee_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  requesterId: string;
  requesterRole: string;
}) {
  const restricted = ['wh_operator', 'driver'];
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (restricted.includes(filters.requesterRole)) {
    params.push(filters.requesterId);
    conditions.push(`s.employee_id = $${params.length}`);
  } else {
    if (filters.employee_id) {
      params.push(filters.employee_id);
      conditions.push(`s.employee_id = $${params.length}`);
    }
  }

  if (filters.date_from) {
    params.push(filters.date_from);
    conditions.push(`s.shift_date >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    conditions.push(`s.shift_date <= $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.*, u.full_name, u.employee_code, u.role AS employee_role, u.department
     FROM shifts s
     JOIN users u ON s.employee_id = u.id
     ${where}
     ORDER BY s.shift_date DESC, s.clock_in DESC NULLS LAST`,
    params
  );
  return rows;
}

export async function getLoginLogs(filters: { user_id?: string; limit: number }) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.user_id) {
    params.push(filters.user_id);
    conditions.push(`ll.user_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT ll.id, ll.user_id, ll.logged_in_at, ll.device_type, ll.ip_address,
            u.employee_code, u.full_name, u.role
     FROM login_logs ll
     JOIN users u ON u.id = ll.user_id
     ${where}
     ORDER BY ll.logged_in_at DESC
     LIMIT $${params.length + 1}`,
    [...params, filters.limit]
  );
  return rows;
}
