import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

function getSecret(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getSecret('JWT_SECRET'), { expiresIn: '15m' });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getSecret('JWT_REFRESH_SECRET'), { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getSecret('JWT_SECRET')) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getSecret('JWT_REFRESH_SECRET')) as RefreshTokenPayload;
}
