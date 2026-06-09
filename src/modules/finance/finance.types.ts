// ─── Branches ─────────────────────────────────────────────────────────────────

export interface CreateBranchBody {
  code: string;
  name: string;
  address?: string;
  contact_person?: string;
  contact_number?: string;
}

// ─── AP (Accounts Payable) ────────────────────────────────────────────────────

export interface CreateSupplierInvoiceBody {
  po_id: string;
  total_amount: number;
  due_date?: string;
  notes?: string;
}

export interface RecordAPPaymentBody {
  supplier_invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
}

// ─── AR (Accounts Receivable) ─────────────────────────────────────────────────

export interface RecordARPaymentBody {
  si_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
}
