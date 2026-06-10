import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import * as Ctrl from './tms.controller';

const router = Router();

// ─── Vehicles ─────────────────────────────────────────────────────────────────
router.get('/vehicles', authGuard, Ctrl.listVehicles);

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post(
  '/routes',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.createRoute
);
router.get(
  '/routes',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.listRoutes
);
// /today and /mine must be registered before /:id to avoid being captured as a param
router.get('/routes/today', authGuard, Ctrl.getMyRoute);
router.get('/routes/mine', authGuard, requireRole('driver', 'system_admin'), Ctrl.listMyRoutes);
router.get('/routes/:id', authGuard, Ctrl.getRoute);
router.post(
  '/routes/start',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher', 'driver'),
  Ctrl.startRoute
);

// ─── GPS ──────────────────────────────────────────────────────────────────────
router.post(
  '/gps',
  authGuard, requireRole('driver', 'system_admin'),
  Ctrl.pingGPS
);
router.get(
  '/gps/live',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.liveGPS
);
router.get(
  '/gps/:route_id/latest',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.routeLatestGPS
);

// ─── Deliveries ───────────────────────────────────────────────────────────────
router.post(
  '/deliveries/confirm',
  authGuard, requireRole('driver', 'system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.confirmDelivery
);

router.get(
  '/deliveries/failed',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.listFailedDeliveries
);
router.post(
  '/deliveries/failed/:stop_id/reschedule',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.rescheduleFailedDelivery
);
router.post(
  '/deliveries/failed/:stop_id/cancel',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.cancelFailedDelivery
);

// ─── Push Token ───────────────────────────────────────────────────────────────
router.post('/push-token', authGuard, Ctrl.savePushToken);

// ─── Fuel ─────────────────────────────────────────────────────────────────────
router.post(
  '/fuel-log',
  authGuard, requireRole('driver', 'system_admin'),
  Ctrl.createFuelLog
);
router.get(
  '/fuel-logs',
  authGuard, requireRole('system_admin', 'operations_manager', 'dispatcher'),
  Ctrl.listFuelLogs
);
router.get('/fuel-logs/mine', authGuard, requireRole('driver', 'system_admin'), Ctrl.listMyFuelLogs);

export default router;
