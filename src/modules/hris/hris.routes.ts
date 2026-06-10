import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import * as HrisController from './hris.controller';

const router = Router();

router.get(
  '/employees',
  authGuard,
  requireRole('system_admin', 'operations_manager', 'hr_manager', 'hr_staff', 'dispatcher'),
  HrisController.getAllEmployees
);

router.post(
  '/employees',
  authGuard,
  requireRole('system_admin', 'hr_manager', 'hr_staff'),
  HrisController.createEmployee
);

router.get('/employees/:id', authGuard, HrisController.getEmployeeById);

router.put(
  '/employees/:id',
  authGuard,
  requireRole('system_admin', 'hr_manager'),
  HrisController.updateEmployee
);

router.put('/employees/:id/password', authGuard, HrisController.changePassword);

router.post(
  '/shifts',
  authGuard,
  requireRole('system_admin', 'hr_manager', 'hr_staff', 'operations_manager'),
  HrisController.createShift
);

router.get('/shifts', authGuard, HrisController.getShifts);

router.post('/attendance', authGuard, HrisController.logAttendance);

router.get('/attendance', authGuard, HrisController.getAttendance);

router.post(
  '/attendance/mark-absent',
  authGuard,
  requireRole('system_admin', 'hr_manager', 'hr_staff', 'operations_manager'),
  HrisController.markAbsent
);

router.get(
  '/login-logs',
  authGuard,
  requireRole('system_admin', 'hr_manager', 'operations_manager'),
  HrisController.getLoginLogs
);

export default router;
