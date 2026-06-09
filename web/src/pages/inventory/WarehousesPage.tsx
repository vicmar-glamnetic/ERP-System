import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { inventoryApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Warehouse } from '../../types';

function CreateWarehouseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', address: '' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => inventoryApi.createWarehouse({ code: form.code, name: form.name, address: form.address || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
      setForm({ code: '', name: '', address: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Warehouse">
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Field label="Code">
          <Input value={form.code} onChange={set('code')} placeholder="WH-01" />
        </Field>
        <Field label="Name">
          <Input value={form.name} onChange={set('name')} placeholder="Main Warehouse" />
        </Field>
      </div>
      <Field label="Address">
        <Input value={form.address} onChange={set('address')} placeholder="Full address" />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.code || !form.name} onClick={() => mut.mutate()}>
          Create Warehouse
        </Btn>
      </div>
    </Modal>
  );
}

export function WarehousesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.warehouses,
  });

  const cols = [
    { key: 'code', label: 'Code', render: (r: Warehouse) => <strong>{r.code}</strong> },
    { key: 'name', label: 'Warehouse Name' },
    { key: 'address', label: 'Address', render: (r: Warehouse) => r.address || '—' },
    { key: 'bin_count', label: 'Bins', render: (r: Warehouse) => r.bin_count ?? '—' },
    { key: 'status', label: 'Status', render: (r: Warehouse) => <Badge status={r.status ?? 'active'} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Warehouses"
        sub={`${data?.length ?? 0} warehouses`}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New Warehouse</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>
      <CreateWarehouseModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
