import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Shift } from '../../types';

function CreateShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', shift_date: '', start_time: '', end_time: '', shift_type: 'regular' });
  const [err, setErr] = useState('');

  const { data: employees } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => hrisApi.employees({ limit: '200' }),
  });

  const mut = useMutation({
    mutationFn: () => hrisApi.createShift({
      employee_id: form.employee_id,
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time: form.end_time || undefined,
      shift_type: form.shift_type,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      onClose();
      setForm({ employee_id: '', shift_date: '', start_time: '', end_time: '', shift_type: 'regular' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Log Shift">
      {err && <Alert type="error" message={err} />}
      <Field label="Employee">
        <Select value={form.employee_id} onChange={set('employee_id')}>
          <option value="">— Select Employee —</option>
          {(employees?.data ?? []).map(e => (
            <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
          ))}
        </Select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date">
          <Input type="date" value={form.shift_date} onChange={set('shift_date')} />
        </Field>
        <Field label="Type">
          <Select value={form.shift_type} onChange={set('shift_type')}>
            {['regular', 'overtime', 'rest_day', 'holiday'].map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Start Time">
          <Input type="time" value={form.start_time} onChange={set('start_time')} />
        </Field>
        <Field label="End Time">
          <Input type="time" value={form.end_time} onChange={set('end_time')} />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.employee_id || !form.shift_date || !form.start_time} onClick={() => mut.mutate()}>
          Log Shift
        </Btn>
      </div>
    </Modal>
  );
}

export function ShiftsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shifts', dateFilter],
    queryFn: () => hrisApi.shifts(dateFilter ? { date: dateFilter } : {}),
  });

  function calcHours(start: string, end?: string | null): string {
    if (!end) return '—';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return '—';
    return `${(mins / 60).toFixed(1)} hrs`;
  }

  const cols = [
    { key: 'shift_date', label: 'Date', render: (r: Shift) => <strong>{new Date(r.shift_date).toLocaleDateString('en-PH')}</strong> },
    { key: 'employee_code', label: 'Code' },
    { key: 'full_name', label: 'Employee' },
    { key: 'shift_type', label: 'Type', render: (r: Shift) => <Badge status={r.shift_type} /> },
    { key: 'start_time', label: 'Time In', render: (r: Shift) => r.start_time },
    { key: 'end_time', label: 'Time Out', render: (r: Shift) => r.end_time ?? '—' },
    { key: 'hours', label: 'Hours', render: (r: Shift) => calcHours(r.start_time, r.end_time) },
    { key: 'status', label: 'Status', render: (r: Shift) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Shifts"
        sub={`${data?.length ?? 0} shift records`}
        actions={
          <>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
            />
            <Btn variant="ghost" size="sm" onClick={() => { setDateFilter(''); refetch(); }}>Clear</Btn>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Log Shift</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>
      <CreateShiftModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
