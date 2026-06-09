import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import * as Ctrl from './finance.controller';

const router = Router();

// ─── Branches ─────────────────────────────────────────────────────────────────
router.post(
  '/branches',
  authGuard, requireRole('system_admin', 'operations_manager'),
  Ctrl.createBranch
);
router.get(
  '/branches',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'dispatcher', 'finance_officer'),
  Ctrl.getBranches
);
router.get(
  '/branches/:id',
  authGuard, requireRole('system_admin', 'operations_manager', 'wh_supervisor', 'dispatcher', 'finance_officer'),
  Ctrl.getBranchById
);

// ─── AP: Supplier Invoices ────────────────────────────────────────────────────
router.post(
  '/ap/invoices',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.createSupplierInvoice
);
router.get(
  '/ap/invoices',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getSupplierInvoices
);
router.get(
  '/ap/invoices/:id',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getSupplierInvoiceById
);
router.post(
  '/ap/payments',
  authGuard, requireRole('system_admin', 'finance_officer'),
  Ctrl.recordAPPayment
);
router.get(
  '/ap/summary',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getAPSummary
);

// ─── AR: Accounts Receivable ──────────────────────────────────────────────────
router.get(
  '/ar/invoices',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getARInvoices
);
router.get(
  '/ar/invoices/:id',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getARInvoiceById
);
router.post(
  '/ar/payments',
  authGuard, requireRole('system_admin', 'finance_officer'),
  Ctrl.recordARPayment
);
router.get(
  '/ar/summary',
  authGuard, requireRole('system_admin', 'finance_officer', 'operations_manager'),
  Ctrl.getARSummary
);

export default router;
