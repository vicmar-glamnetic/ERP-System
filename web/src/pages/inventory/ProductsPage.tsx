import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { inventoryApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Textarea, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Product } from '../../types';

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n ?? 0);
}

function CreateProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sku: '', name: '', description: '', category: '', uom: 'pcs',
    unit_cost: '', unit_price: '', reorder_point: '',
  });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => inventoryApi.createProduct({
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      uom: form.uom,
      unit_cost: parseFloat(form.unit_cost) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
      reorder_point: parseInt(form.reorder_point) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
      setForm({ sku: '', name: '', description: '', category: '', uom: 'pcs', unit_cost: '', unit_price: '', reorder_point: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Product" width={540}>
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Field label="SKU">
          <Input value={form.sku} onChange={set('sku')} placeholder="SKU-001" />
        </Field>
        <Field label="Product Name">
          <Input value={form.name} onChange={set('name')} placeholder="Product name" />
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={form.description} onChange={set('description')} placeholder="Optional description" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Category">
          <Input value={form.category} onChange={set('category')} placeholder="Electronics" />
        </Field>
        <Field label="UOM">
          <Select value={form.uom} onChange={set('uom')}>
            {['pcs', 'kg', 'liters', 'box', 'carton', 'roll', 'set', 'pair'].map(u => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Reorder Point">
          <Input type="number" value={form.reorder_point} onChange={set('reorder_point')} placeholder="10" />
        </Field>
        <Field label="Unit Cost (PHP)">
          <Input type="number" step="0.01" value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" />
        </Field>
        <Field label="Unit Price (PHP)">
          <Input type="number" step="0.01" value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.sku || !form.name} onClick={() => mut.mutate()}>
          Create Product
        </Btn>
      </div>
    </Modal>
  );
}

export function ProductsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', page],
    queryFn: () => inventoryApi.products(page, 50),
  });

  const cols = [
    { key: 'sku', label: 'SKU', render: (r: Product) => <strong>{r.sku}</strong> },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', render: (r: Product) => r.category || '—' },
    { key: 'uom', label: 'UOM' },
    { key: 'unit_cost', label: 'Cost', render: (r: Product) => fmt(r.unit_cost) },
    { key: 'unit_price', label: 'Price', render: (r: Product) => fmt(r.unit_price) },
    { key: 'reorder_point', label: 'Reorder At', render: (r: Product) => r.reorder_point ?? 0 },
    { key: 'status', label: 'Status', render: (r: Product) => <Badge status={r.status ?? 'active'} /> },
  ];

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / 50);

  return (
    <div>
      <PageHeader
        title="Products"
        sub={`${total} products`}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New Product</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data?.data ?? []} />}
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Btn>
          <span style={{ lineHeight: '32px', fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {pageCount}</span>
          <Btn variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Next</Btn>
        </div>
      )}

      <CreateProductModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
