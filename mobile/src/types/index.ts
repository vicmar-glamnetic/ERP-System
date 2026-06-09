export interface User {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
  department: string;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  uom: string;
  category: string;
}

export interface BinLocation {
  id: string;
  aisle: string;
  bay: string;
  level: string;
  warehouse_id: string;
}

export interface PickTask {
  id: string;
  so_id: string;
  product_id: string;
  bin_id: string;
  qty_to_pick: number;
  qty_picked: number;
  status: string;
  product_sku: string;
  product_name: string;
  aisle: string;
  bay: string;
  level: string;
  warehouse_name: string;
}

export interface POLine {
  id: string;
  po_id: string;
  product_id: string;
  qty_ordered: number;
  qty_received: number;
  sku: string;
  name: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  expected_date: string;
  lines: POLine[];
}

export interface DeliveryStop {
  id: string;
  route_id: string;
  so_id: string | null;
  stop_sequence: number;
  address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  status: string;
  notes: string | null;
  delivered_at: string | null;
  so_number?: string;
}

export interface Route {
  id: string;
  route_date: string;
  status: string;
  vehicle_id: string;
  driver_id: string;
  plate_number: string;
  vehicle_type: string;
  driver_name: string;
  stops: DeliveryStop[];
  started_at: string | null;
  completed_at: string | null;
}
