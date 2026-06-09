import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, DollarSign } from 'lucide-react';
import { financeApi, wmsApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Textarea, Alert, Spinner, KpiCard } from '../../components/ui';
import { apiError } from '../../api/client';
import type { SupplierInvoice } from '../../types';

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);
}

function CreateSINVModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ po_id: '', supplier_name: '', total_amount: '', due_date: '', notes: '' });
  const [err, setErr] = useState('');
  const { data: pos } = useQuery({ queryKey: ['pos-all'], queryFn: () => wmsApi.pos({}) });

  const mut = useMutation({
    mutationFn: () => financeApi.createSupplierInvoice({
      po_id: form.po_id || undefined,
      supplier_name: form.supplier_name,
      total_amount: parseFloat(form.total_amount),
      due_date: form.due_date || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-invoices'] });
      qc.invalidateQueries({ queryKey: ['ap-summary'] });
      onClose();
      setForm({ po_id: '', supplier_name: '', total_amount: '', due_date: '', notes: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Record Supplier Invoice">
      {err && <Alert type="error" message={err} />}
      <Field label="Supplier Name">
        <Input value={form.supplier_name} onChange={set('supplier_name')} placeholder="Supplier Co." />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Link to PO (optional)">
          <Select value={form.po_id} onChange={set('po_id')}>
            <option value="">— None —</option>
            {(pos?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name}</option>)}
          </Select>
        </Field>
        <Field label="Total Amount (PHP)">
          <Input type="number" step="0.01" value={form.total_amount} onChange={set('total_amount')} placeholder="0.00" />
        </Field>
        <Field label="Due Date">
          <Input type="date" value={form.due_date} onChange={set('due_date')} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={set('notes')} placeholder="Optional" />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.supplier_name || !form.total_amount} onClick={() => mut.mutate()}>
          Create Invoice
        </Btn>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ inv, open, onClose }: { inv: SupplierInvoice | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: '', payment_method: 'bank_transfer', reference_no: '', notes: '' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => financeApi.recordAPPayment({
      supplier_invoice_id: inv!.id,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      reference_no: form.reference_no || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-invoices'] });
      qc.invalidateQueries({ queryKey: ['ap-summary'] });
      onClose();
      setForm({ amount: '', payment_method: 'bank_transfer', reference_no: '', notes: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={`Record Payment — ${inv?.inv_number}`}>
      {err && <Alert type="error" message={err} />}
      {inv && (
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Balance Due</span>
            <strong style={{ color: 'var(--danger)', fontSize: 15 }}>{fmt(inv.balance_due)}</strong>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Amount (PHP)">
          <Input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </Field>
        <Field label="Method">
          <Select value={form.payment_method} onChange={set('payment_method')}>
            {['bank_transfer', 'check', 'cash', 'online'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Reference #">
        <Input value={form.reference_no} onChange={set('reference_no')} placeholder="Cheque / transaction ref" />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={set('notes')} placeholder="Optional" />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.amount} onClick={() => mut.mutate()}>Record Payment</Btn>
      </div>
    </Modal>
  );
}

export function APPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget, setPayTarget] = useState<SupplierInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: summary } = useQuery({ queryKey: ['ap-summary'], queryFn: financeApi.apSummary });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ap-invoices', statusFilter],
    queryFn: () => financeApi.supplierInvoices(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'inv_number', label: 'Invoice #', render: (r: SupplierInvoice) => <strong>{r.inv_number}</strong> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'total_amount', label: 'Total', render: (r: SupplierInvoice) => fmt(r.total_amount) },
    { key: 'amount_paid', label: 'Paid', render: (r: SupplierInvoice) => fmt(r.amount_paid) },
    { key: 'balance_due', label: 'Balance', render: (r: SupplierInvoice) => <strong style={{ color: r.balance_due > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.balance_due)}</strong> },
    { key: 'payment_status', label: 'Status', render: (r: SupplierInvoice) => <Badge status={r.payment_status} /> },
    { key: 'due_date', label: 'Due', render: (r: SupplierInvoice) => r.due_date ? new Date(r.due_date).toLocaleDateString('en-PH') : '—' },
    {
      key: 'actions', label: '', render: (r: SupplierInvoice) =>
        r.payment_status !== 'paid' ? (
          <Btn size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setPayTarget(r); }}>
            <DollarSign size={12} /> Pay
          </Btn>
        ) : null
    },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Payable" value={fmt(summary?.total_payable)} sub="All outstanding" />
        <KpiCard label="Total Paid" value={fmt(summary?.total_paid)} sub="This period" />
        <KpiCard label="Overdue" value={String(summary?.overdue_count ?? 0)} sub="Past due date" danger />
      </div>

      <PageHeader
        title="Accounts Payable"
        sub="Supplier invoices and payments"
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {['', 'unpaid', 'partial', 'paid'].map(s => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New Invoice</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>

      <CreateSINVModal open={showCreate} onClose={() => setShowCreate(false)} />
      <RecordPaymentModal inv={payTarget} open={!!payTarget} onClose={() => setPayTarget(null)} />
    </div>
  );
}
