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
// /today must be registered before /:id to avoid being captured as a param
router.get('/routes/today', authGuard, Ctrl.getMyRoute);
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

export default router;
