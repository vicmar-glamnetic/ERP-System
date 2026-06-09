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
  page: number;
  limit: number;
}): Promise<{ data: EmployeeRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.department) {
    params.push(filters.department);
    conditions.push(`department = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = parseInt(countResult.rows[0].count as string, 10);

  const offset = (filters.page - 1) * filters.limit;
  const dataResult = await pool.query(
    `SELECT ${EMPLOYEE_COLUMNS} FROM users ${where}
     ORDER BY created_at DESC
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
    `INSERT INTO shifts (employee_id, shift_date, zone, clock_in, clock_out)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      body.employee_id,
      body.shift_date,
      body.zone ?? null,
      body.clock_in ?? null,
      body.clock_out ?? null,
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
     ORDER BY s.shift_date DESC, s.clock_in`,
    params
  );

  return rows;
}

export async function logAttendance(employeeId: string, eventType: string) {
  const { rows } = await pool.query(
    `INSERT INTO attendance_logs (employee_id, event_type) VALUES ($1, $2) RETURNING *`,
    [employeeId, eventType]
  );
  return rows[0];
}
