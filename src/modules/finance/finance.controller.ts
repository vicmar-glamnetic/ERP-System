import { Request, Response, NextFunction } from 'express';
import * as FinanceService from './finance.service';
import { ServiceError } from '../auth/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import {
  CreateBranchBody,
  CreateSupplierInvoiceBody,
  RecordAPPaymentBody,
  RecordARPaymentBody,
} from './finance.types';

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.createBranch(req.body as CreateBranchBody);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await FinanceService.getBranches({ status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getBranchById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branch = await FinanceService.getBranchById(req.params['id'] as string);
    if (!branch) { sendError(res, 'NOT_FOUND', 'Branch not found', 404); return; }
    sendSuccess(res, branch);
  } catch (err) { handleError(err, res, next); }
}

// ─── AP: Supplier Invoices ────────────────────────────────────────────────────

export async function createSupplierInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.createSupplierInvoice(
      req.body as CreateSupplierInvoiceBody,
      req.user!.userId
    );
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getSupplierInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment_status = req.query['payment_status'] as string | undefined;
    const po_id          = req.query['po_id']          as string | undefined;
    const page  = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await FinanceService.getSupplierInvoices({ payment_status, po_id, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getSupplierInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await FinanceService.getSupplierInvoiceById(req.params['id'] as string);
    if (!invoice) { sendError(res, 'NOT_FOUND', 'Supplier invoice not found', 404); return; }
    sendSuccess(res, invoice);
  } catch (err) { handleError(err, res, next); }
}

export async function recordAPPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.recordAPPayment(
      req.body as RecordAPPaymentBody,
      req.user!.userId
    );
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getAPSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.getAPSummary();
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── AR: Sales Invoices + Payments ───────────────────────────────────────────

export async function getARInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment_status = req.query['payment_status'] as string | undefined;
    const branch_id      = req.query['branch_id']      as string | undefined;
    const page  = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await FinanceService.getARInvoices({ payment_status, branch_id, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getARInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await FinanceService.getARInvoiceById(req.params['id'] as string);
    if (!invoice) { sendError(res, 'NOT_FOUND', 'AR invoice not found', 404); return; }
    sendSuccess(res, invoice);
  } catch (err) { handleError(err, res, next); }
}

export async function recordARPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.recordARPayment(
      req.body as RecordARPaymentBody,
      req.user!.userId
    );
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function getARSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await FinanceService.getARSummary();
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}
