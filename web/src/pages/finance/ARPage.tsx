import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, DollarSign } from 'lucide-react';
import { financeApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Textarea, Alert, Spinner, KpiCard } from '../../components/ui';
import { apiError } from '../../api/client';
import type { SalesInvoice } from '../../types';

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);
}

function RecordPaymentModal({ inv, open, onClose }: { inv: SalesInvoice | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: '', payment_method: 'bank_transfer', reference_no: '', notes: '' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => financeApi.recordARPayment({
      si_id: inv!.id,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      reference_no: form.reference_no || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-invoices'] });
      qc.invalidateQueries({ queryKey: ['ar-summary'] });
      onClose();
      setForm({ amount: '', payment_method: 'bank_transfer', reference_no: '', notes: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={`Record Collection — ${inv?.si_number}`}>
      {err && <Alert type="error" message={err} />}
      {inv && (
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{inv.customer_name}</div>
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
        <Btn loading={mut.isPending} disabled={!form.amount} onClick={() => mut.mutate()}>Record Collection</Btn>
      </div>
    </Modal>
  );
}

export function ARPage() {
  const [payTarget, setPayTarget] = useState<SalesInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: summary } = useQuery({ queryKey: ['ar-summary'], queryFn: financeApi.arSummary });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ar-invoices', statusFilter],
    queryFn: () => financeApi.arInvoices(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'si_number', label: 'Invoice #', render: (r: SalesInvoice) => <strong>{r.si_number}</strong> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'total_amount', label: 'Total', render: (r: SalesInvoice) => fmt(r.total_amount) },
    { key: 'amount_paid', label: 'Collected', render: (r: SalesInvoice) => fmt(r.amount_paid) },
    { key: 'balance_due', label: 'Balance', render: (r: SalesInvoice) => <strong style={{ color: r.balance_due > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.balance_due)}</strong> },
    { key: 'payment_status', label: 'Status', render: (r: SalesInvoice) => <Badge status={r.payment_status} /> },
    { key: 'issued_at', label: 'Issued', render: (r: SalesInvoice) => new Date(r.issued_at).toLocaleDateString('en-PH') },
    {
      key: 'actions', label: '', render: (r: SalesInvoice) =>
        r.payment_status !== 'paid' ? (
          <Btn size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setPayTarget(r); }}>
            <DollarSign size={12} /> Collect
          </Btn>
        ) : null
    },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Receivable" value={fmt(summary?.total_receivable)} sub="All outstanding" />
        <KpiCard label="Total Collected" value={fmt(summary?.total_collected)} sub="This period" />
        <KpiCard label="Overdue" value={String(summary?.overdue_count ?? 0)} sub="Past due date" danger />
      </div>

      <PageHeader
        title="Accounts Receivable"
        sub="Customer invoice collections"
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {['', 'unpaid', 'partial', 'paid'].map(s => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>

      <RecordPaymentModal inv={payTarget} open={!!payTarget} onClose={() => setPayTarget(null)} />
    </div>
  );
}
