import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart } from 'lucide-react';
import { wmsApi, inventoryApi, financeApi } from '../../api';
import { Field, Input, Select, Btn, Alert } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Branch } from '../../types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);
}

interface LineItem { product_id: string; qty_ordered: number; unit_price: number }

export function NewOrderPage() {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', qty_ordered: 1, unit_price: 0 }]);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => inventoryApi.products(1, 500) });
  const { data: branches } = useQuery<Branch[]>({ queryKey: ['branches'], queryFn: () => financeApi.branches() });

  const productMap = Object.fromEntries((products?.data ?? []).map(p => [p.id, p]));

  const setLine = (i: number, k: keyof LineItem, v: string | number) => {
    const next = [...lines];
    if (k === 'product_id') {
      next[i].product_id = v as string;
      const p = productMap[v as string];
      if (p) next[i].unit_price = p.unit_price ?? 0;
    } else {
      (next[i] as any)[k] = v;
    }
    setLines(next);
  };

  const total = lines.reduce((s, l) => s + (l.qty_ordered * l.unit_price), 0);

  const mut = useMutation({
    mutationFn: () => wmsApi.createSO({
      customer_name: customerName,
      branch_id: branchId || undefined,
      notes: notes || undefined,
      lines: lines.filter(l => l.product_id).map(l => ({
        product_id: l.product_id,
        qty_ordered: l.qty_ordered,
        unit_price: l.unit_price,
      })),
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['sos'] });
      setSuccess(`Order ${data.so_number} created successfully.`);
      setCustomerName('');
      setBranchId('');
      setNotes('');
      setLines([{ product_id: '', qty_ordered: 1, unit_price: 0 }]);
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const validLines = lines.filter(l => l.product_id);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Place New Order</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create a Sales Order for a branch or direct customer</p>
      </div>

      {err && <Alert type="error" message={err} />}
      {success && <Alert type="success" message={success} />}

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 12 }}>
          Order Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Customer Name *">
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Juan Dela Cruz / ABC Company" />
          </Field>
          <Field label="Branch (optional)">
            <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">— Walk-in / Direct —</option>
              {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </Field>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 12 }}>
          Line Items
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 80px 28px', gap: 8, marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          <div>Product</div>
          <div>Qty</div>
          <div>Unit Price</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div />
        </div>

        {lines.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 80px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select value={line.product_id} onChange={e => setLine(i, 'product_id', e.target.value)}>
              <option value="">— Select Product —</option>
              {(products?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
            <Input type="number" min={1} value={line.qty_ordered}
              onChange={e => setLine(i, 'qty_ordered', parseInt(e.target.value) || 1)} />
            <Input type="number" min={0} step="0.01" value={line.unit_price}
              onChange={e => setLine(i, 'unit_price', parseFloat(e.target.value) || 0)} />
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
              {fmt(line.qty_ordered * line.unit_price)}
            </div>
            <button
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}
              disabled={lines.length === 1}
            >✕</button>
          </div>
        ))}

        <Btn variant="ghost" size="sm" onClick={() => setLines([...lines, { product_id: '', qty_ordered: 1, unit_price: 0 }])}>
          <Plus size={12} /> Add Line
        </Btn>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{validLines.length} line{validLines.length !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(total)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn
          loading={mut.isPending}
          disabled={validLines.length === 0 || !customerName.trim()}
          onClick={() => { setSuccess(''); mut.mutate(); }}
          style={{ fontSize: 15, padding: '10px 28px' }}
        >
          <ShoppingCart size={15} /> Place Order
        </Btn>
      </div>
    </div>
  );
}
