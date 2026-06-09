export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface BinLocationRow {
  id: string;
  warehouse_id: string;
  aisle: string;
  bay: string;
  level: string;
  capacity: number;
  is_active: boolean;
  qty_total?: number;
}

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  uom: string;
  reorder_point: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryRow {
  id: string;
  product_id: string;
  bin_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  lot_number: string | null;
  expiry_date: Date | null;
  updated_at: Date;
}

export interface InventoryWithDetails extends InventoryRow {
  sku: string;
  product_name: string;
  warehouse_name: string;
  aisle: string;
  bay: string;
  level: string;
  qty_available: number;
  is_low_stock: boolean;
}

export interface CreateProductBody {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  uom: string;
  reorder_point?: number;
}

export interface UpdateProductBody {
  name?: string;
  description?: string;
  category?: string;
  uom?: string;
  reorder_point?: number;
  is_active?: boolean;
}

export interface CreateWarehouseBody {
  code: string;
  name: string;
  location?: string;
}

export interface CreateBinBody {
  warehouse_id: string;
  aisle: string;
  bay: string;
  level: string;
  capacity?: number;
}

export interface StockAdjustmentBody {
  product_id: string;
  bin_id: string;
  qty: number;
  lot_number?: string;
  expiry_date?: string;
  reason: string;
}
