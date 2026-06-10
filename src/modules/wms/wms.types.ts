export interface POLineInput {
  product_id: string;
  qty_ordered: number;
  unit_cost?: number;
}

export interface CreatePOBody {
  supplier_name: string;
  expected_date?: string;
  notes?: string;
  lines: POLineInput[];
}

export interface ReceiveStockBody {
  po_line_id: string;
  bin_id: string;
  qty_received: number;
  lot_number?: string;
  expiry_date?: string;
}

export interface SOLineInput {
  product_id: string;
  qty_ordered: number;
  unit_price?: number;
}

export interface CreateSOBody {
  customer_name: string;
  required_date?: string;
  notes?: string;
  branch_id?: string;
  lines: SOLineInput[];
}

export interface AssignPickTaskBody {
  so_id: string;
  assigned_to: string;
}

export interface ConfirmPickBody {
  pick_task_id: string;
  qty_picked: number;
  bin_id: string;
}

export interface DispatchBody {
  so_id: string;
}

// ─── Putaway ──────────────────────────────────────────────────────────────────

export interface GeneratePutawayBody {
  grn_log_id: string;
  from_bin_id: string;
  to_bin_id: string;
  qty: number;
  assigned_to: string;
}

export interface CompletePutawayBody {
  putaway_task_id: string;
  scanned_bin_id: string;
}

// ─── Check Tasks ──────────────────────────────────────────────────────────────

export interface GenerateCheckTasksBody {
  so_id: string;
  assigned_to?: string;
}

export interface ConfirmCheckBody {
  check_task_id: string;
  qty_checked: number;
}

export interface FailCheckBody {
  check_task_id: string;
  notes: string;
}

// ─── Sales Invoice ────────────────────────────────────────────────────────────

export interface GenerateInvoiceBody {
  so_id: string;
  unit_prices?: { product_id: string; unit_price: number }[];
}
