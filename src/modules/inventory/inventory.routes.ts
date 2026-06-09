import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import * as Ctrl from './inventory.controller';

// ─── /inventory ───────────────────────────────────────────────────────────────
export const inventoryRouter = Router();

inventoryRouter.get(
  '/low-stock',
  authGuard,
  requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.getLowStock
);
inventoryRouter.get('/', authGuard, Ctrl.getAllInventory);
inventoryRouter.post(
  '/adjust',
  authGuard,
  requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.adjustStock
);

// ─── /products ────────────────────────────────────────────────────────────────
export const productsRouter = Router();

productsRouter.get('/', authGuard, Ctrl.getAllProducts);
productsRouter.get('/:sku', authGuard, Ctrl.getProductBySku);
productsRouter.post(
  '/',
  authGuard,
  requireRole('system_admin', 'operations_manager'),
  Ctrl.createProduct
);
productsRouter.put(
  '/:id',
  authGuard,
  requireRole('system_admin', 'operations_manager'),
  Ctrl.updateProduct
);

// ─── /warehouses ──────────────────────────────────────────────────────────────
export const warehousesRouter = Router();

warehousesRouter.get('/', authGuard, Ctrl.getWarehouses);
warehousesRouter.post(
  '/',
  authGuard,
  requireRole('system_admin', 'operations_manager'),
  Ctrl.createWarehouse
);
warehousesRouter.get('/:id/bins', authGuard, Ctrl.getBins);
warehousesRouter.post(
  '/:id/bins',
  authGuard,
  requireRole('system_admin', 'operations_manager', 'wh_supervisor'),
  Ctrl.createBin
);
