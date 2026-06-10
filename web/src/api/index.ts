import { api } from './client';
import type {
  PurchaseOrder, POLine, SalesOrder, SalesInvoice, SILine,
  CheckTask, Product, Warehouse, BinLocation, InventoryRow,
  Vehicle, Route, LiveGPS, Branch, SupplierInvoice, Employee, Shift, LoginLog,
  GRNLog, PutawayTask,
} from '../types';

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (employee_code: string, password: string) =>
    api.post('/auth/login', { employee_code, password }).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: async () => {
    const [sos, pos, routes, arSummary, apSummary] = await Promise.all([
      api.get('/wms/sales-orders?limit=1').then((r) => r.data.data),
      api.get('/wms/purchase-orders?limit=1').then((r) => r.data.data),
      api.get('/tms/routes?limit=1').then((r) => r.data.data),
      api.get('/finance/ar/summary').then((r) => r.data.data),
      api.get('/finance/ap/summary').then((r) => r.data.data),
    ]);
    return { sos, pos, routes, arSummary, apSummary };
  },
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  warehouses: (): Promise<Warehouse[]> => api.get('/warehouses').then((r) => r.data.data),
  warehouseBins: (id: string): Promise<BinLocation[]> =>
    api.get(`/warehouses/${id}/bins`).then((r) => r.data.data),
  products: (page = 1, limit = 50): Promise<{ data: Product[]; total: number }> =>
    api.get(`/products?page=${page}&limit=${limit}`).then((r) => r.data.data),
  createProduct: (body: Partial<Product>) =>
    api.post('/products', body).then((r) => r.data.data),
  stock: (params?: Record<string, string>): Promise<InventoryRow[]> =>
    api.get('/inventory', { params }).then((r) => r.data.data?.data ?? r.data.data ?? []),
  createWarehouse: (body: unknown) => api.post('/warehouses', body).then((r) => r.data.data),
};

// ─── WMS ──────────────────────────────────────────────────────────────────────
export const wmsApi = {
  // POs
  pos: (params?: Record<string, string>): Promise<{ data: PurchaseOrder[]; total: number }> =>
    api.get('/wms/purchase-orders', { params }).then((r) => r.data.data),
  po: (id: string): Promise<PurchaseOrder & { lines: POLine[] }> =>
    api.get(`/wms/purchase-orders/${id}`).then((r) => r.data.data),
  createPO: (body: unknown) => api.post('/wms/purchase-orders', body).then((r) => r.data.data),
  receiveStock: (body: unknown) => api.post('/wms/receive', body).then((r) => r.data.data),

  // SOs
  sos: (params?: Record<string, string>): Promise<{ data: SalesOrder[]; total: number }> =>
    api.get('/wms/sales-orders', { params }).then((r) => r.data.data),
  so: (id: string): Promise<SalesOrder & { lines: any[] }> =>
    api.get(`/wms/sales-orders/${id}`).then((r) => r.data.data),
  createSO: (body: unknown) => api.post('/wms/sales-orders', body).then((r) => r.data.data),

  // Pick tasks
  generatePickTasks: (so_id: string, assigned_to: string) =>
    api.post('/wms/pick-tasks/generate', { so_id, assigned_to }).then((r) => r.data.data),

  // Check tasks
  checkTasks: (params?: Record<string, string>): Promise<CheckTask[]> =>
    api.get('/wms/check-tasks', { params }).then((r) => r.data.data),
  generateCheckTasks: (so_id: string, assigned_to?: string) =>
    api.post('/wms/check-tasks/generate', { so_id, assigned_to }).then((r) => r.data.data),

  // Invoices
  invoices: (params?: Record<string, string>): Promise<SalesInvoice[]> =>
    api.get('/wms/invoices', { params }).then((r) => r.data.data),
  invoice: (id: string): Promise<SalesInvoice & { lines: SILine[] }> =>
    api.get(`/wms/invoices/${id}`).then((r) => r.data.data),
  generateInvoice: (body: unknown) => api.post('/wms/invoices', body).then((r) => r.data.data),

  // Dispatch
  dispatch: (so_id: string) => api.post('/wms/dispatch', { so_id }).then((r) => r.data.data),

  // Putaway task management
  grnLogs: (po_id: string): Promise<GRNLog[]> =>
    api.get(`/wms/purchase-orders/${po_id}/grn-logs`).then((r) => r.data.data ?? []),
  putawayTasks: (params?: Record<string, string>): Promise<PutawayTask[]> =>
    api.get('/wms/putaway/tasks', { params }).then((r) => r.data.data),
  generatePutawayTasks: (grn_ids: string[], assigned_to: string) =>
    api.post('/wms/putaway/generate-tasks', { grn_ids, assigned_to }).then((r) => r.data.data),
};

// ─── TMS ──────────────────────────────────────────────────────────────────────
export const tmsApi = {
  vehicles: (): Promise<Vehicle[]> => api.get('/tms/vehicles').then((r) => r.data.data),
  createVehicle: (body: unknown) => api.post('/tms/vehicles', body).then((r) => r.data.data),
  routes: (params?: Record<string, string>): Promise<Route[]> =>
    api.get('/tms/routes', { params }).then((r) => r.data.data),
  route: (id: string): Promise<Route> => api.get(`/tms/routes/${id}`).then((r) => r.data.data),
  createRoute: (body: unknown) => api.post('/tms/routes', body).then((r) => r.data.data),
  liveGPS: (): Promise<LiveGPS[]> => api.get('/tms/gps/live').then((r) => r.data.data),
  fuelLogs: (params?: Record<string, string>) =>
    api.get('/tms/fuel-logs', { params }).then((r) => r.data.data),

  failedDeliveries: (params?: Record<string, string>) =>
    api.get('/tms/deliveries/failed', { params }).then((r) => r.data.data),
  rescheduleFailedDelivery: (stop_id: string, route_id: string, stop_sequence: number) =>
    api.post(`/tms/deliveries/failed/${stop_id}/reschedule`, { route_id, stop_sequence }).then((r) => r.data.data),
  cancelFailedDelivery: (stop_id: string, reason: string) =>
    api.post(`/tms/deliveries/failed/${stop_id}/cancel`, { reason }).then((r) => r.data.data),
};

// ─── Finance ──────────────────────────────────────────────────────────────────
export const financeApi = {
  branches: (params?: Record<string, string>): Promise<Branch[]> =>
    api.get('/finance/branches', { params }).then((r) => r.data.data),
  branch: (id: string): Promise<Branch> =>
    api.get(`/finance/branches/${id}`).then((r) => r.data.data),
  createBranch: (body: unknown) =>
    api.post('/finance/branches', body).then((r) => r.data.data),

  supplierInvoices: (params?: Record<string, string>): Promise<SupplierInvoice[]> =>
    api.get('/finance/ap/invoices', { params }).then((r) => r.data.data),
  supplierInvoice: (id: string) => api.get(`/finance/ap/invoices/${id}`).then((r) => r.data.data),
  createSupplierInvoice: (body: unknown) =>
    api.post('/finance/ap/invoices', body).then((r) => r.data.data),
  apInvoices: (params?: Record<string, string>): Promise<SupplierInvoice[]> =>
    api.get('/finance/ap/invoices', { params }).then((r) => r.data.data),
  apInvoice: (id: string) => api.get(`/finance/ap/invoices/${id}`).then((r) => r.data.data),
  createAPInvoice: (body: unknown) =>
    api.post('/finance/ap/invoices', body).then((r) => r.data.data),
  recordAPPayment: (body: unknown) =>
    api.post('/finance/ap/payments', body).then((r) => r.data.data),
  apSummary: () => api.get('/finance/ap/summary').then((r) => r.data.data),

  arInvoices: (params?: Record<string, string>): Promise<SalesInvoice[]> =>
    api.get('/finance/ar/invoices', { params }).then((r) => r.data.data),
  arInvoice: (id: string) => api.get(`/finance/ar/invoices/${id}`).then((r) => r.data.data),
  recordARPayment: (body: unknown) =>
    api.post('/finance/ar/payments', body).then((r) => r.data.data),
  arSummary: () => api.get('/finance/ar/summary').then((r) => r.data.data),
};

// ─── HRIS ─────────────────────────────────────────────────────────────────────
export const hrisApi = {
  employees: (params?: Record<string, string>): Promise<{ data: Employee[]; total: number }> =>
    api.get('/hris/employees', { params }).then((r) => r.data.data),
  employee: (id: string): Promise<Employee> =>
    api.get(`/hris/employees/${id}`).then((r) => r.data.data),
  createEmployee: (body: unknown) =>
    api.post('/hris/employees', body).then((r) => r.data.data),
  shifts: (params?: Record<string, string>): Promise<Shift[]> =>
    api.get('/hris/shifts', { params }).then((r) => r.data.data),
  createShift: (body: unknown) =>
    api.post('/hris/shifts', body).then((r) => r.data.data),
  loginLogs: (params?: Record<string, string>): Promise<LoginLog[]> =>
    api.get('/hris/login-logs', { params }).then((r) => r.data.data),
  attendance: (params?: Record<string, string>): Promise<Shift[]> =>
    api.get('/hris/attendance', { params }).then((r) => r.data.data),
  markAbsent: () =>
    api.post('/hris/attendance/mark-absent').then((r) => r.data.data),
};
