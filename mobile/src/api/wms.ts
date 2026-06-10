import { apiClient } from './client';
import { PickTask, PurchaseOrder, BinLocation, CheckTask as CheckTaskType } from '../types';

export async function getMyPickTasks(): Promise<PickTask[]> {
  const { data } = await apiClient.get('/wms/pick-tasks/mine');
  return data.data as PickTask[];
}

export async function confirmPick(
  pick_task_id: string,
  qty_picked: number,
  bin_id: string
): Promise<void> {
  await apiClient.post('/wms/pick-tasks/confirm', { pick_task_id, qty_picked, bin_id });
}

export async function getPOs(status?: string): Promise<PurchaseOrder[]> {
  const params: Record<string, string> = { limit: '200' };
  if (status) params['status'] = status;
  const { data } = await apiClient.get('/wms/purchase-orders', { params });
  // Backend returns { success, data: { data: [...], total: N } }
  return (data.data?.data ?? data.data ?? []) as PurchaseOrder[];
}

export async function getPOById(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.get(`/wms/purchase-orders/${id}`);
  return data.data as PurchaseOrder;
}

export async function receiveStock(
  po_line_id: string,
  bin_id: string,
  qty_received: number,
  lot_number?: string
): Promise<void> {
  await apiClient.post('/wms/receive', { po_line_id, bin_id, qty_received, lot_number });
}

export async function getWarehouseBins(warehouseId: string): Promise<BinLocation[]> {
  const { data } = await apiClient.get(`/warehouses/${warehouseId}/bins`);
  return data.data as BinLocation[];
}

export async function getWarehouses(): Promise<{ id: string; code: string; name: string }[]> {
  const { data } = await apiClient.get('/warehouses');
  return data.data;
}

// ─── Putaway ──────────────────────────────────────────────────────────────────

export interface PutawayTask {
  id: string;
  grn_log_id: string;
  product_id: string;
  qty: number;
  from_bin_id: string;
  to_bin_id: string;
  status: string;
  product_sku: string;
  product_name: string;
  from_aisle: string;
  from_bay: string;
  from_level: string;
  to_aisle: string;
  to_bay: string;
  to_level: string;
}

export interface PendingPutawayItem {
  grn_log_id: string;
  product_sku: string;
  product_name: string;
  qty_received: number;
  lot_number: string | null;
  received_at?: string;
}

export async function getMyPutawayTasks(): Promise<PutawayTask[]> {
  const { data } = await apiClient.get('/wms/putaway/mine');
  return data.data as PutawayTask[];
}

export async function confirmPutaway(
  putaway_task_id: string,
  scanned_bin_id: string
): Promise<void> {
  await apiClient.post('/wms/putaway/confirm', { putaway_task_id, scanned_bin_id });
}

export async function getPendingPutaway(): Promise<PendingPutawayItem[]> {
  const { data } = await apiClient.get('/wms/putaway/pending');
  return data.data as PendingPutawayItem[];
}

export async function confirmPutawayFreeForm(
  grn_log_id: string,
  bin_id: string
): Promise<void> {
  await apiClient.post('/wms/putaway/confirm-free', { grn_log_id, bin_id });
}

export async function getBinBarcode(binId: string): Promise<{
  id: string;
  label: string;
  display: string;
}> {
  const { data } = await apiClient.get(`/wms/barcode/bin/${binId}`);
  return data.data;
}

// ─── Check Tasks ──────────────────────────────────────────────────────────────

export interface CheckTask {
  id: string;
  so_id: string;
  so_line_id: string;
  product_id: string;
  qty_expected: number;
  qty_checked: number;
  status: string;
  product_sku: string;
  product_name: string;
  so_number: string;
  customer_name: string;
}

export async function getMyCheckTasks(): Promise<CheckTask[]> {
  const { data } = await apiClient.get('/wms/check-tasks/mine');
  return data.data as CheckTask[];
}

export async function confirmCheckTask(
  check_task_id: string,
  qty_checked: number
): Promise<void> {
  await apiClient.post('/wms/check-tasks/confirm', { check_task_id, qty_checked });
}

export async function failCheckTask(
  check_task_id: string,
  notes: string
): Promise<void> {
  await apiClient.post('/wms/check-tasks/fail', { check_task_id, notes });
}

export async function getCheckTasks(): Promise<CheckTaskType[]> {
  const { data } = await apiClient.get('/wms/check-tasks/grouped');
  return data.data as CheckTaskType[];
}

export async function completeCheckTask(
  soId: string,
  passed: boolean,
  notes?: string
): Promise<void> {
  await apiClient.post(`/wms/check-tasks/${soId}/complete`, { passed, notes });
}
