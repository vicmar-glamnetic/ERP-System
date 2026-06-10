import { Request, Response, NextFunction } from 'express';
import * as WmsService from './wms.service';
import { ServiceError } from '../auth/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import {
  CreatePOBody,
  ReceiveStockBody,
  CreateSOBody,
  AssignPickTaskBody,
  ConfirmPickBody,
  DispatchBody,
  GeneratePutawayBody,
  CompletePutawayBody,
  GenerateCheckTasksBody,
  ConfirmCheckBody,
  FailCheckBody,
  GenerateInvoiceBody,
} from './wms.types';

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export async function getGRNLogsForPO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.getGRNLogsForPO(req.params['id'] as string);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function createPO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.createPO(req.body as CreatePOBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getPOs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await WmsService.getPOs({ status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getPOById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const po = await WmsService.getPOById(req.params['id'] as string);
    if (!po) { sendError(res, 'NOT_FOUND', 'Purchase order not found', 404); return; }
    sendSuccess(res, po);
  } catch (err) { handleError(err, res, next); }
}

export async function receiveStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.receiveStock(req.body as ReceiveStockBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export async function createSO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.createSO(req.body as CreateSOBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getSOs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await WmsService.getSOs({ status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getSOById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const so = await WmsService.getSOById(req.params['id'] as string);
    if (!so) { sendError(res, 'NOT_FOUND', 'Sales order not found', 404); return; }
    sendSuccess(res, so);
  } catch (err) { handleError(err, res, next); }
}

// ─── Pick Tasks ───────────────────────────────────────────────────────────────

export async function generatePickTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { so_id, assigned_to } = req.body as AssignPickTaskBody;
    const tasks = await WmsService.generatePickTasks(so_id, assigned_to);
    sendSuccess(res, tasks, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getMyPickTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await WmsService.getMyPickTasks(req.user!.userId);
    sendSuccess(res, tasks);
  } catch (err) { handleError(err, res, next); }
}

export async function confirmPick(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.confirmPick(req.body as ConfirmPickBody, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatchSO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.dispatchSO(req.body as DispatchBody, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Putaway ──────────────────────────────────────────────────────────────────

export async function generatePutawayTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { grn_ids, assigned_to } = req.body as { grn_ids: string[]; assigned_to: string };
    if (!Array.isArray(grn_ids) || grn_ids.length === 0) {
      sendError(res, 'INVALID_INPUT', 'grn_ids must be a non-empty array', 400); return;
    }
    const result = await WmsService.generatePutawayTasks(grn_ids, assigned_to, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getPutawayTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    const isOperator = role === 'wh_operator';
    const tasks = await WmsService.getPutawayTasks({
      employee_id: isOperator ? req.user!.userId : (req.query['employee_id'] as string | undefined),
      status: req.query['status'] as string | undefined,
      own_only: isOperator,
    });
    sendSuccess(res, tasks);
  } catch (err) { handleError(err, res, next); }
}

export async function confirmPutawayTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bin_id } = req.body as { bin_id: string };
    if (!bin_id) { sendError(res, 'INVALID_INPUT', 'bin_id is required', 400); return; }
    const result = await WmsService.confirmPutawayTask(req.params['id'] as string, bin_id, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function generatePutaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.generatePutaway(req.body as GeneratePutawayBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getMyPutawayTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await WmsService.getMyPutawayTasks(req.user!.userId);
    sendSuccess(res, tasks);
  } catch (err) { handleError(err, res, next); }
}

export async function completePutaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.completePutaway(req.body as CompletePutawayBody, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getPendingPutaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await WmsService.getPendingPutaway(req.user!.userId);
    sendSuccess(res, items);
  } catch (err) { handleError(err, res, next); }
}

export async function confirmPutawayFreeForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.confirmPutawayFreeForm(req.body, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Check Tasks ──────────────────────────────────────────────────────────────

export async function generateCheckTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.generateCheckTasks(req.body as GenerateCheckTasksBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getCheckTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const so_id  = req.query['so_id']  as string | undefined;
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await WmsService.getCheckTasks({ so_id, status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getMyCheckTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await WmsService.getMyCheckTasks(req.user!.userId);
    sendSuccess(res, tasks);
  } catch (err) { handleError(err, res, next); }
}

export async function confirmCheckTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.confirmCheckTask(req.body as ConfirmCheckBody, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function failCheckTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.failCheckTask(req.body as FailCheckBody, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getCheckTasksGrouped(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.getCheckTasksGrouped(req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function completeSOCheckTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const soId = req.params['so_id'] as string;
    const { passed, notes } = req.body as { passed: boolean; notes?: string };
    const result = await WmsService.completeSOCheckTasks(soId, passed, notes, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Sales Invoice ────────────────────────────────────────────────────────────

export async function generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WmsService.generateInvoice(req.body as GenerateInvoiceBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await WmsService.getInvoices({ status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await WmsService.getInvoiceById(req.params['id'] as string);
    if (!invoice) { sendError(res, 'NOT_FOUND', 'Invoice not found', 404); return; }
    sendSuccess(res, invoice);
  } catch (err) { handleError(err, res, next); }
}

// ─── Barcode ──────────────────────────────────────────────────────────────────

export async function getBinBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await WmsService.getBinBarcodeData(req.params['binId'] as string);
    if (!data) { sendError(res, 'NOT_FOUND', 'Bin not found', 404); return; }
    sendSuccess(res, data);
  } catch (err) { handleError(err, res, next); }
}

export async function getProductBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await WmsService.getProductBarcodeData(req.params['productId'] as string);
    if (!data) { sendError(res, 'NOT_FOUND', 'Product not found', 404); return; }
    sendSuccess(res, data);
  } catch (err) { handleError(err, res, next); }
}
