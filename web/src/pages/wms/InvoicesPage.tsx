import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, RefreshCw } from 'lucide-react';
import { wmsApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Spinner } from '../../components/ui';
import type { SalesInvoice, SILine } from '../../types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);
}

function InvoiceDetailModal({ inv, open, onClose }: { inv: SalesInvoice | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', inv?.id],
    queryFn: () => wmsApi.invoice(inv!.id),
    enabled: !!inv?.id,
  });

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w || !data) return;
    const lines: SILine[] = (data as any).lines ?? [];
    w.document.write(`
      <html><head><title>${data.si_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto}
      h1{color:#0F6E56}table{width:100%;border-collapse:collapse;margin-top:20px}
      th{background:#0F6E56;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
      td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
      .total{text-align:right;font-size:16px;font-weight:700;margin-top:16px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0;font-size:13px}
      .label{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
      </style></head><body>
      <h1>Sales Invoice</h1>
      <div class="meta">
        <div><div class="label">Invoice #</div><strong>${data.si_number}</strong></div>
        <div><div class="label">SO #</div>${data.so_number ?? '—'}</div>
        <div><div class="label">Customer</div>${data.customer_name}</div>
        <div><div class="label">Date</div>${new Date(data.issued_at).toLocaleDateString('en-PH')}</div>
      </div>
      <table>
        <thead><tr><th>Product</th><th>SKU</th><th>UOM</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          ${lines.map(l => `<tr><td>${l.product_name}</td><td>${l.product_sku}</td><td>${l.uom}</td><td>${l.qty}</td><td>${fmt(l.unit_price)}</td><td>${fmt(l.line_total)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="total">Total: ${fmt(data.total_amount)}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Invoice — ${inv?.si_number}`} width={640}>
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              ['Customer', data.customer_name],
              ['SO Number', data.so_number ?? '—'],
              ['Status', null],
              ['Date', new Date(data.issued_at).toLocaleDateString('en-PH')],
            ].map(([label, val]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
                {label === 'Status' ? <Badge status={data.payment_status} /> : <div style={{ fontWeight: 600 }}>{val as string}</div>}
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Product', 'Qty', 'Unit Price', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((data as any).lines ?? []).map((l: SILine) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px' }}>{l.product_name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({l.product_sku})</span></td>
                  <td style={{ padding: '8px 10px' }}>{l.qty} {l.uom}</td>
                  <td style={{ padding: '8px 10px' }}>{fmt(l.unit_price)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paid: {fmt(data.amount_paid)} · Balance: {fmt(data.balance_due)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{fmt(data.total_amount)}</span>
              <Btn size="sm" variant="ghost" onClick={handlePrint}><Printer size={13} /> Print</Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export function InvoicesPage() {
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => wmsApi.invoices(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'si_number', label: 'Invoice #', render: (r: SalesInvoice) => <strong>{r.si_number}</strong> },
    { key: 'so_number', label: 'SO #' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'total_amount', label: 'Amount', render: (r: SalesInvoice) => <strong>{fmt(r.total_amount)}</strong> },
    { key: 'payment_status', label: 'Payment', render: (r: SalesInvoice) => <Badge status={r.payment_status} /> },
    { key: 'issued_at', label: 'Issued', render: (r: SalesInvoice) => new Date(r.issued_at).toLocaleDateString('en-PH') },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Invoices"
        sub="Click an invoice to view and print"
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
        {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} onRow={setSelected} />}
      </div>
      <InvoiceDetailModal inv={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
