import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { wmsApi, inventoryApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { PurchaseOrder } from '../../types';

function CreatePOModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product_id: '', qty_ordered: 1, unit_cost: 0 }]);
  const [err, setErr] = useState('');

  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => inventoryApi.products(1, 200) });

  const mut = useMutation({
    mutationFn: () => wmsApi.createPO({ supplier_name: supplier, expected_date: expectedDate || undefined, notes: notes || undefined, lines: lines.filter(l => l.product_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pos'] }); onClose(); setSupplier(''); setLines([{ product_id: '', qty_ordered: 1, unit_cost: 0 }]); setErr(''); },
    onError: (e) => setErr(apiError(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Create Purchase Order" width={560}>
      {err && <Alert type="error" message={err} />}
      <Field label="Supplier Name">
        <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier company" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Expected Date">
          <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Line Items</div>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select value={line.product_id} onChange={e => { const l = [...lines]; l[i].product_id = e.target.value; setLines(l); }}>
              <option value="">— Product —</option>
              {(products?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
            <Input type="number" min={1} placeholder="Qty" value={line.qty_ordered} onChange={e => { const l = [...lines]; l[i].qty_ordered = parseInt(e.target.value) || 1; setLines(l); }} />
            <Input type="number" min={0} step="0.01" placeholder="Unit cost" value={line.unit_cost} onChange={e => { const l = [...lines]; l[i].unit_cost = parseFloat(e.target.value) || 0; setLines(l); }} />
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        ))}
        <Btn variant="ghost" size="sm" onClick={() => setLines([...lines, { product_id: '', qty_ordered: 1, unit_cost: 0 }])}>
          <Plus size={12} /> Add Line
        </Btn>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} onClick={() => mut.mutate()}>Create PO</Btn>
      </div>
    </Modal>
  );
}

export function PurchaseOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pos', statusFilter],
    queryFn: () => wmsApi.pos(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'po_number', label: 'PO #', render: (r: PurchaseOrder) => <strong>{r.po_number}</strong> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'status', label: 'Status', render: (r: PurchaseOrder) => <Badge status={r.status} /> },
    { key: 'expected_date', label: 'Expected', render: (r: PurchaseOrder) => r.expected_date ? new Date(r.expected_date).toLocaleDateString('en-PH') : '—' },
    { key: 'lines_count', label: 'Lines' },
    { key: 'created_at', label: 'Created', render: (r: PurchaseOrder) => new Date(r.created_at).toLocaleDateString('en-PH') },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        sub={`${data?.data?.length ?? 0} orders`}
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {['', 'pending', 'receiving', 'received', 'cancelled'].map(s => (
                <option key={s} value={s}>{s || 'All statuses'}</option>
              ))}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New PO</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data?.data ?? []} />}
      </div>
      <CreatePOModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
