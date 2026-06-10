import { Request, Response, NextFunction } from 'express';
import * as HrisService from './hris.service';
import { ServiceError } from '../auth/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  ChangePasswordBody,
  CreateShiftBody,
  AttendanceBody,
} from './hris.types';

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

export async function getAllEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const department = req.query['department'] as string | undefined;
    const role = req.query['role'] as string | undefined;
    const page = parseInt((req.query['page'] as string) ?? '1', 10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;

    const result = await HrisService.getAllEmployees({ status, department, role, page, limit });
    sendSuccess(res, result);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function getEmployeeById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await HrisService.getEmployeeById(req.params['id'] as string);
    if (!employee) {
      sendError(res, 'NOT_FOUND', 'Employee not found', 404);
      return;
    }
    sendSuccess(res, employee);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await HrisService.createEmployee(req.body as CreateEmployeeBody);
    sendSuccess(res, employee, 201);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await HrisService.updateEmployee(
      req.params['id'] as string,
      req.body as UpdateEmployeeBody
    );
    if (!employee) {
      sendError(res, 'NOT_FOUND', 'Employee not found', 404);
      return;
    }
    sendSuccess(res, employee);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await HrisService.changePassword(
      req.params['id'] as string,
      req.body as ChangePasswordBody,
      req.user!.userId,
      req.user!.role
    );
    sendSuccess(res, { message: 'Password updated successfully' });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function createShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shift = await HrisService.createShift(req.body as CreateShiftBody);
    sendSuccess(res, shift, 201);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function getShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee_id = req.query['employee_id'] as string | undefined;
    const date_from = req.query['date_from'] as string | undefined;
    const date_to = req.query['date_to'] as string | undefined;
    const department = req.query['department'] as string | undefined;

    const shifts = await HrisService.getShifts({
      employee_id,
      date_from,
      date_to,
      department,
      requesterId: req.user!.userId,
      requesterRole: req.user!.role,
    });
    sendSuccess(res, shifts);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function logAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { event_type } = req.body as AttendanceBody;
    const log = await HrisService.logAttendance(req.user!.userId, event_type);
    sendSuccess(res, log, 201);
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function getLoginLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user_id = req.query['user_id'] as string | undefined;
    const limit = parseInt((req.query['limit'] as string) ?? '100', 10) || 100;
    const logs = await HrisService.getLoginLogs({ user_id, limit });
    sendSuccess(res, logs);
  } catch (err) {
    handleError(err, res, next);
  }
}
