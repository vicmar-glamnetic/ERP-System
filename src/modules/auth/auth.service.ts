import bcrypt from 'bcrypt';
import { pool } from '../../db/client';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';

export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

const PERMISSIONS: Record<string, string[]> = {
  system_admin: ['inventory:full', 'orders:full', 'finance:full', 'wms:full', 'tms:full', 'hris:full', 'reports:full'],
  operations_manager: ['inventory:write', 'orders:write', 'finance:read', 'wms:full', 'tms:full', 'shifts:write', 'reports:read'],
  finance_officer: ['inventory:read', 'orders:read', 'finance:full', 'reports:read', 'payroll:read'],
  wh_supervisor: ['inventory:read', 'orders:read', 'wms:full', 'shifts:read'],
  wh_operator: ['wms:own', 'shifts:own'],
  dispatcher: ['orders:read', 'dispatch:read', 'tms:full', 'shifts:read', 'reports:full'],
  driver: ['routes:own', 'gps:own', 'pod:own', 'shifts:own'],
  hr_manager: ['hris:full', 'payroll:full'],
  hr_staff: ['employees:write', 'shifts:write', 'payroll:read'],
  checker: ['wms:check', 'wms:so:read', 'inventory:read', 'shifts:own'],
};

export async function login(employeeCode: string, password: string, meta?: { ip?: string; device_type?: string }) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE employee_code = $1',
    [employeeCode]
  );

  const user = rows[0];

  if (!user) {
    throw new ServiceError('INVALID_CREDENTIALS', 'Invalid employee code or password', 401);
  }

  if (user.status !== 'active') {
    throw new ServiceError('ACCOUNT_INACTIVE', 'Account is inactive', 403);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new ServiceError('INVALID_CREDENTIALS', 'Invalid employee code or password', 401);
  }

  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  void pool.query(
    'INSERT INTO login_logs (user_id, device_type, ip_address) VALUES ($1, $2, $3)',
    [user.id, meta?.device_type ?? 'web', meta?.ip ?? null]
  );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
    },
  };
}

export async function refresh(refreshToken: string) {
  const { rows } = await pool.query(
    `SELECT rt.*, u.role FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1`,
    [refreshToken]
  );

  const record = rows[0];

  if (!record) {
    throw new ServiceError('INVALID_TOKEN', 'Invalid refresh token', 401);
  }

  if (new Date(record.expires_at) < new Date()) {
    throw new ServiceError('TOKEN_EXPIRED', 'Refresh token has expired', 401);
  }

  const payload = verifyRefreshToken(refreshToken);
  const accessToken = generateAccessToken({ userId: payload.userId, role: record.role });

  return { access_token: accessToken };
}

export async function logout(userId: string) {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

export async function getMe(userId: string) {
  const { rows } = await pool.query(
    `SELECT id, employee_code, full_name, email, role, department, manager_id, status, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = rows[0];

  if (!user) {
    throw new ServiceError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    ...user,
    permissions: PERMISSIONS[user.role] ?? [],
  };
}
