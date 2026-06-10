import { Request, Response, NextFunction } from 'express';
import * as AuthService from './auth.service';
import { ServiceError } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { LoginBody, RefreshBody } from './auth.types';

function handleServiceError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { employee_code, password } = req.body as LoginBody;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? undefined;
    const userAgent = req.headers['user-agent'] ?? '';
    const device_type = /expo|okhttp|dart/i.test(userAgent) ? 'mobile' : 'web';
    const result = await AuthService.login(employee_code, password, { ip, device_type });
    sendSuccess(res, result);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refresh_token } = req.body as RefreshBody;
    const result = await AuthService.refresh(refresh_token);
    sendSuccess(res, result);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AuthService.logout(req.user!.userId);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await AuthService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}
