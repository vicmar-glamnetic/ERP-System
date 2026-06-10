import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import * as Ctrl from './wms.controller';

const router = Router();

// ─── Purchase Orders ──────────────────────────────────────────────────────────
router.post(
  '/purchase-orders',
  authGuard, requireRole('system_admin', 'operations_manager'),
  Ctrl.createPO
);
router.get(
  '/purchase-orders',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'wh_operator'),
  Ctrl.getPOs
);
router.get(
  '/purchase-orders/:id',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'wh_operator'),
  Ctrl.getPOById
);
router.get(
  '/purchase-orders/:id/grn-logs',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'wh_operator'),
  Ctrl.getGRNLogsForPO
);
router.post(
  '/receive',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'),
  Ctrl.receiveStock
);

// ─── Sales Orders ─────────────────────────────────────────────────────────────
router.post(
  '/sales-orders',
  authGuard, requireRole('system_admin', 'operations_manager'),
  Ctrl.createSO
);
router.get(
  '/sales-orders',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'dispatcher'),
  Ctrl.getSOs
);
router.get(
  '/sales-orders/:id',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'dispatcher', 'checker'),
  Ctrl.getSOById
);

// ─── Pick Tasks ───────────────────────────────────────────────────────────────
router.post(
  '/pick-tasks/generate',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.generatePickTasks
);
router.get('/pick-tasks/mine', authGuard, Ctrl.getMyPickTasks);
router.post(
  '/pick-tasks/confirm',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'),
  Ctrl.confirmPick
);

// ─── Dispatch ─────────────────────────────────────────────────────────────────
router.post(
  '/dispatch',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'dispatcher'),
  Ctrl.dispatchSO
);

// ─── Putaway ──────────────────────────────────────────────────────────────────

// New assignment-based flow
router.post(
  '/putaway/generate-tasks',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.generatePutawayTasks
);
router.get('/putaway/tasks', authGuard, Ctrl.getPutawayTasks);
router.post(
  '/putaway/tasks/:id/confirm',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'),
  Ctrl.confirmPutawayTaskById
);

// Legacy freeform flow (kept for mobile fallback)
router.post(
  '/putaway/generate',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.generatePutaway
);
router.get('/putaway/mine', authGuard, Ctrl.getMyPutawayTasks);
router.get('/putaway/pending', authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'), Ctrl.getPendingPutaway);
router.post(
  '/putaway/confirm',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'),
  Ctrl.completePutaway
);
router.post(
  '/putaway/confirm-free',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'wh_operator'),
  Ctrl.confirmPutawayFreeForm
);

// ─── Check Tasks ──────────────────────────────────────────────────────────────
router.post(
  '/check-tasks/generate',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.generateCheckTasks
);
router.get(
  '/check-tasks',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'checker'),
  Ctrl.getCheckTasks
);
router.get('/check-tasks/mine', authGuard, Ctrl.getMyCheckTasks);
router.get('/check-tasks/grouped', authGuard, Ctrl.getCheckTasksGrouped);
router.post('/check-tasks/:so_id/complete', authGuard, requireRole('system_admin', 'wh_supervisor', 'checker', 'wh_operator'), Ctrl.completeSOCheckTasks);
router.post(
  '/check-tasks/confirm',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'checker'),
  Ctrl.confirmCheckTask
);
router.post(
  '/check-tasks/fail',
  authGuard, requireRole('system_admin', 'wh_supervisor', 'checker'),
  Ctrl.failCheckTask
);

// ─── Sales Invoices ───────────────────────────────────────────────────────────
router.post(
  '/invoices',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.generateInvoice
);
router.get(
  '/invoices',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'finance_officer'),
  Ctrl.getInvoices
);
router.get(
  '/invoices/:id',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'finance_officer'),
  Ctrl.getInvoiceById
);

// ─── Barcode ──────────────────────────────────────────────────────────────────
router.get('/barcode/bin/:binId',         authGuard, Ctrl.getBinBarcode);
router.get('/barcode/product/:productId', authGuard, Ctrl.getProductBarcode);

export default router;
