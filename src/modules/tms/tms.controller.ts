import { Request, Response, NextFunction } from 'express';
import * as TmsService from './tms.service';
import { ServiceError } from '../auth/auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import {
  CreateRouteBody,
  StartRouteBody,
  GPSPingBody,
  ConfirmDeliveryBody,
  FuelLogBody,
} from './tms.types';

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ServiceError) {
    sendError(res, err.code, err.message, err.status);
  } else {
    next(err);
  }
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function listVehicles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicles = await TmsService.getVehicles();
    sendSuccess(res, vehicles);
  } catch (err) { handleError(err, res, next); }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.createRoute(req.body as CreateRouteBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function listRoutes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const page   = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit  = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await TmsService.getRoutes({ status, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function getMyRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const route = await TmsService.getMyRoute(req.user!.userId);
    if (!route) { sendError(res, 'NOT_FOUND', 'No route assigned for today', 404); return; }
    sendSuccess(res, route);
  } catch (err) { handleError(err, res, next); }
}

export async function getRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const route = await TmsService.getRouteById(req.params['id'] as string);
    if (!route) { sendError(res, 'NOT_FOUND', 'Route not found', 404); return; }
    sendSuccess(res, route);
  } catch (err) { handleError(err, res, next); }
}

export async function startRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { route_id } = req.body as StartRouteBody;
    const result = await TmsService.startRoute(route_id, req.user!.userId, req.user!.role);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── GPS ──────────────────────────────────────────────────────────────────────

export async function pingGPS(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.logGPS(req.body as GPSPingBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function liveGPS(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.getAllActiveGPS();
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function routeLatestGPS(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const log = await TmsService.getLatestGPS(req.params['route_id'] as string);
    if (!log) { sendError(res, 'NOT_FOUND', 'No GPS data for this route', 404); return; }
    sendSuccess(res, log);
  } catch (err) { handleError(err, res, next); }
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export async function confirmDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.confirmDelivery(
      req.body as ConfirmDeliveryBody,
      req.user!.userId,
      req.user!.role
    );
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function listFailedDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resolution = req.query['resolution'] as string | undefined;
    const result = await TmsService.getFailedDeliveries(resolution);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function rescheduleFailedDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stop_id = req.params['stop_id'] as string;
    const { route_id, stop_sequence } = req.body as { route_id: string; stop_sequence: number };
    if (!route_id || !stop_sequence) {
      sendError(res, 'INVALID_INPUT', 'route_id and stop_sequence are required', 400); return;
    }
    const result = await TmsService.rescheduleFailedDelivery(stop_id, route_id, stop_sequence, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function cancelFailedDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stop_id = req.params['stop_id'] as string;
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) {
      sendError(res, 'INVALID_INPUT', 'reason is required', 400); return;
    }
    const result = await TmsService.cancelFailedDelivery(stop_id, reason, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Fuel ─────────────────────────────────────────────────────────────────────

export async function createFuelLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.submitFuelLog(req.body as FuelLogBody, req.user!.userId);
    sendSuccess(res, result, 201);
  } catch (err) { handleError(err, res, next); }
}

export async function listFuelLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicle_id = req.query['vehicle_id'] as string | undefined;
    const driver_id  = req.query['driver_id']  as string | undefined;
    const page  = parseInt((req.query['page']  as string) ?? '1',  10) || 1;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;
    const result = await TmsService.getFuelLogs({ vehicle_id, driver_id, page, limit });
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function listMyRoutes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const result = await TmsService.getMyRoutes(req.user!.userId, status);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

export async function listMyFuelLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await TmsService.getMyFuelLogs(req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handleError(err, res, next); }
}

// ─── Push Token ───────────────────────────────────────────────────────────────

export async function savePushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { push_token } = req.body as { push_token: string };
    await TmsService.savePushToken(req.user!.userId, push_token);
    sendSuccess(res, { saved: true });
  } catch (err) { handleError(err, res, next); }
}
