import { Request, Response, NextFunction } from 'express';
import * as InventoryService from './inventory.service';
import { ServiceError } from '../auth/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import {
  CreateWarehouseBody,
  CreateBinBody,
  CreateProductBody,
  UpdateProductBody,
  StockAdjustmentBody,
} from './inventory.types';

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export async function getWarehouses(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouses = await InventoryService.getWarehouses();
    sendSuccess(res, warehouses);
  } catch (err) { handleError(err, res, next); }
}

export async function createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouse = await InventoryService.createWarehouse(req.body as CreateWarehouseBody);
    sendSuccess(res, warehouse, 201);
  } catch (err) { handleError(err, res, next); }
}

// ─── Bins ─────────────────────────────────────────────────────────────────────

export async function getBins(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bins = await InventoryService.getBins(req.params['id'] as string);
    sendSuccess(res, bins);
  } catch (err) { handleError(err, res, next); }
}

export async function createBin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bin = await InventoryService.createBin({
      ...(req.body as CreateBinBody),
      warehouse_id: req.params['id'] as string,
    });
    sendSuccess(res, bin, 201);
  } catch (err) { handleError(err, res, next); }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category   = req.query['category'] as string | undefined;
    const is_active  = req.query['is_active'] as string | undefined;
    const page  = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;

    const result = await InventoryService.getAllProducts({ category, is_active, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getProductBySku(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await InventoryService.getProductBySku(req.params['sku'] as string);
    if (!product) {
      sendError(res, 'NOT_FOUND', 'Product not found', 404);
      return;
    }
    sendSuccess(res, product);
  } catch (err) { handleError(err, res, next); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await InventoryService.createProduct(req.body as CreateProductBody);
    sendSuccess(res, product, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await InventoryService.updateProduct(
      req.params['id'] as string,
      req.body as UpdateProductBody
    );
    if (!product) {
      sendError(res, 'NOT_FOUND', 'Product not found', 404);
      return;
    }
    sendSuccess(res, product);
  } catch (err) { handleError(err, res, next); }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getAllInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouse_id = req.query['warehouse_id'] as string | undefined;
    const product_id   = req.query['product_id']   as string | undefined;
    const low_stock    = req.query['low_stock'] === 'true';
    const page  = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;

    const result = await InventoryService.getInventory({ warehouse_id, product_id, low_stock, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getLowStock(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await InventoryService.getInventory({ low_stock: true, page: 1, limit: 100 });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await InventoryService.adjustStock(
      req.body as StockAdjustmentBody,
      req.user!.userId
    );
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}
