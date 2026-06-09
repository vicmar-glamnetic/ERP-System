import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { tmsApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Vehicle } from '../../types';

function CreateVehicleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ plate_number: '', type: 'truck', capacity_kg: '', make: '', model: '', year: '' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => tmsApi.createVehicle({
      plate_number: form.plate_number,
      type: form.type,
      capacity_kg: parseFloat(form.capacity_kg) || undefined,
      make: form.make || undefined,
      model: form.model || undefined,
      year: parseInt(form.year) || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
      setForm({ plate_number: '', type: 'truck', capacity_kg: '', make: '', model: '', year: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Add Vehicle">
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Plate Number">
          <Input value={form.plate_number} onChange={set('plate_number')} placeholder="ABC 1234" />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={set('type')}>
            {['truck', 'van', 'motorcycle', 'pickup'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Make">
          <Input value={form.make} onChange={set('make')} placeholder="Isuzu" />
        </Field>
        <Field label="Model">
          <Input value={form.model} onChange={set('model')} placeholder="Elf" />
        </Field>
        <Field label="Year">
          <Input type="number" value={form.year} onChange={set('year')} placeholder="2022" />
        </Field>
        <Field label="Capacity (kg)">
          <Input type="number" value={form.capacity_kg} onChange={set('capacity_kg')} placeholder="1000" />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.plate_number} onClick={() => mut.mutate()}>Add Vehicle</Btn>
      </div>
    </Modal>
  );
}

export function VehiclesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vehicles'],
    queryFn: tmsApi.vehicles,
  });

  const cols = [
    { key: 'plate_number', label: 'Plate', render: (r: Vehicle) => <strong>{r.plate_number}</strong> },
    { key: 'type', label: 'Type', render: (r: Vehicle) => r.type },
    { key: 'make', label: 'Make/Model', render: (r: Vehicle) => [r.make, r.model, r.year].filter(Boolean).join(' ') || '—' },
    { key: 'capacity_kg', label: 'Capacity', render: (r: Vehicle) => r.capacity_kg ? `${r.capacity_kg.toLocaleString()} kg` : '—' },
    { key: 'status', label: 'Status', render: (r: Vehicle) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Vehicles"
        sub={`${data?.length ?? 0} vehicles registered`}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Add Vehicle</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>
      <CreateVehicleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
