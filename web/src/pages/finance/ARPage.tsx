import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, DollarSign } from 'lucide-react';
import { financeApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Textarea, Alert, Spinner, KpiCard } from '../../components/ui';
import { apiError } from '../../api/client';
import type { SalesInvoice, SILine } from '../../types';

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

function InvoiceDetailModal({ inv, open, onClose, onPay }: { inv: SalesInvoice | null; open: boolean; onClose: () => void; onPay: (i: SalesInvoice) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ar-invoice-detail', inv?.id],
    queryFn: () => financeApi.arInvoice(inv!.id),
    enabled: !!inv?.id,
    staleTime: 0,
  });
  const detail = data as any;
  return (
    <Modal open={open} onClose={onClose} title={`Invoice — ${inv?.si_number}`} width={620}>
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div> : detail && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[['Customer', detail.customer_name], ['SO #', detail.so_number], ['Branch', detail.branch_name ?? '—']].map(([l, v]) => (
              <div key={l} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4, marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{v as string}</div>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['SKU', 'Product', 'Qty', 'Unit Price', 'Total'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.lines ?? []).map((l: SILine) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{l.product_sku}</td>
                  <td style={{ padding: '8px 10px' }}>{l.product_name}</td>
                  <td style={{ padding: '8px 10px' }}>{l.qty} {l.uom}</td>
                  <td style={{ padding: '8px 10px' }}>{fmt(l.unit_price)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13, marginBottom: 16 }}>
            <span style={{ color: 'var(--text-muted)' }}>Total: <strong>{fmt(detail.total_amount)}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>Collected: <strong style={{ color: 'var(--success)' }}>{fmt(detail.amount_paid)}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>Balance: <strong style={{ color: detail.balance_due > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(detail.balance_due)}</strong></span>
          </div>
          {detail.payment_status !== 'paid' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={() => { onClose(); onPay(inv!); }}><DollarSign size={13} /> Collect Payment</Btn>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function ARPage() {
  const [payTarget, setPayTarget] = useState<SalesInvoice | null>(null);
  const [detailTarget, setDetailTarget] = useState<SalesInvoice | null>(null);
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
        <KpiCard label="Total Receivable" value={fmt(summary?.total_outstanding)} sub={`${(summary?.unpaid_count ?? 0) + (summary?.partial_count ?? 0)} unpaid/partial invoices`} color="var(--primary)" />
        <KpiCard label="Total Collected" value={fmt(summary?.total_collected)} sub={`${summary?.paid_count ?? 0} paid invoices`} color="var(--success)" />
        <KpiCard label="Overdue (30d+)" value={String(summary?.overdue_count ?? 0)} sub="Unpaid over 30 days" danger />
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
          : <Table cols={cols} rows={data ?? []} onRow={r => setDetailTarget(r)} />}
      </div>

      <RecordPaymentModal inv={payTarget} open={!!payTarget} onClose={() => setPayTarget(null)} />
      <InvoiceDetailModal inv={detailTarget} open={!!detailTarget} onClose={() => setDetailTarget(null)} onPay={i => setPayTarget(i)} />
    </div>
  );
}
