export interface User {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  permissions: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

// WMS
export interface PurchaseOrder {
  id: string; po_number: string; supplier_name: string;
  status: string; expected_date: string; lines_count: number;
  created_at: string; notes?: string;
}
export interface POLine {
  id: string; po_id: string; product_id: string;
  qty_ordered: number; qty_received: number; sku: string; name: string;
}
export interface SalesOrder {
  id: string; so_number: string; customer_name: string;
  status: string; required_date: string; lines_count: number;
  created_at: string; branch_id?: string; notes?: string;
}
export interface SOLine {
  id: string; so_id: string; product_id: string;
  qty_ordered: number; sku: string; name: string;
}
export interface PickTask {
  id: string; so_id: string; so_number: string;
  product_id: string; product_sku: string; product_name: string;
  bin_id: string; aisle: string; bay: string; level: string;
  qty_to_pick: number; qty_picked: number; status: string;
  assigned_to: string; assignee_name?: string;
}
export interface CheckTask {
  id: string; so_id: string; so_number: string; customer_name: string;
  product_id: string; product_sku: string; product_name: string;
  qty_expected: number; qty_checked: number; status: string;
  assigned_to?: string; checker_name?: string; notes?: string;
}
export interface SalesInvoice {
  id: string; si_number: string; so_id: string; so_number: string;
  customer_name: string; status: string; total_amount: number;
  amount_paid: number; balance_due: number; payment_status: string;
  issued_at: string;
}
export interface SILine {
  id: string; product_sku: string; product_name: string;
  uom: string; qty: number; unit_price: number; line_total: number;
}

// Inventory
export interface Product {
  id: string; sku: string; name: string; description?: string; category?: string;
  uom: string; reorder_point?: number; unit_cost?: number; unit_price?: number;
  is_active?: boolean; status?: string;
}
export interface Warehouse {
  id: string; code: string; name: string; address?: string;
  location?: string; bin_count?: number; is_active?: boolean; status?: string;
}
export interface BinLocation {
  id: string; warehouse_id: string; aisle: string; bay: string;
  level: string; type: string; capacity: number; qty_total: number; is_active: boolean;
}
export interface InventoryRow {
  product_id: string; sku: string; product_name?: string; name?: string;
  category?: string; uom: string;
  bin_id?: string; bin_code?: string; aisle?: string; bay?: string; level?: string;
  warehouse_name?: string; warehouse_code?: string;
  qty_on_hand: number; qty_reserved?: number; qty_available?: number;
  reorder_point?: number; lot_number?: string;
}

// TMS
export interface Vehicle {
  id: string; plate_number: string; type: string;
  make?: string; model?: string; year?: number; capacity_kg?: number;
  fuel_capacity?: number; status: string;
}
export interface DeliveryStop {
  id: string; route_id: string; so_id?: string; so_number?: string;
  stop_sequence: number; address: string; recipient_name?: string;
  recipient_phone?: string; status: string; delivered_at?: string;
  pod_photo_url?: string; signature_url?: string; notes?: string;
}
export interface Route {
  id: string; route_date: string; status: string;
  vehicle_id: string; plate_number: string; vehicle_type: string;
  driver_id: string; driver_name: string;
  stops: DeliveryStop[]; started_at?: string; completed_at?: string;
}
export interface LiveGPS {
  route_id: string; driver_id: string; driver_name: string;
  plate_number: string; latitude: number; longitude: number;
  speed_kmh: number; logged_at: string;
}

// Finance
export interface Branch {
  id: string; code: string; name: string; address?: string;
  contact_person?: string; contact_number?: string; status: string;
  total_orders?: number; total_invoiced?: number; total_outstanding?: number;
}
export interface SupplierInvoice {
  id: string; inv_number: string; po_id: string; po_number: string;
  supplier_name: string; total_amount: number; amount_paid: number;
  balance_due: number; payment_status: string; due_date?: string; notes?: string;
}

// HRIS
export interface Employee {
  id: string; employee_code: string; full_name: string; email?: string;
  role: string; department?: string; position?: string;
  hire_date?: string; status: string; created_at: string;
}
export interface Shift {
  id: string; employee_id: string; employee_name?: string;
  employee_code?: string; full_name?: string;
  shift_date: string; shift_type: string; start_time: string;
  end_time?: string | null; status: string; notes?: string;
}
