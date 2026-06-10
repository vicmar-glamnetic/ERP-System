import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, UserX } from 'lucide-react';
import { hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Shift } from '../../types';
import { useAuth } from '../../context/AuthContext';

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

const STATUS_COLOR: Record<string, string> = {
  present: '#16a34a',
  late: '#d97706',
  absent: '#dc2626',
};

export function ShiftsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [markAbsentMsg, setMarkAbsentMsg] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shifts', dateFilter],
    queryFn: () => hrisApi.shifts(dateFilter ? { date: dateFilter } : {}),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['attendance', dateFilter],
    queryFn: () => hrisApi.attendance(dateFilter ? { date_from: dateFilter, date_to: dateFilter } : {}),
  });

  const markAbsentMut = useMutation({
    mutationFn: () => hrisApi.markAbsent(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setMarkAbsentMsg(`Marked ${result.marked_absent} employee(s) as absent.`);
      setTimeout(() => setMarkAbsentMsg(''), 5000);
    },
  });

  const isHR = ['system_admin', 'hr_manager', 'hr_staff', 'operations_manager'].includes(user?.role ?? '');

  // Attendance summary for today / filtered date
  const summary = (attendanceData ?? []).reduce(
    (acc, s) => {
      const st = s.status ?? 'present';
      acc[st] = (acc[st] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function fmtTime(ts?: string | null): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

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
    { key: 'start_time', label: 'Sched In', render: (r: Shift) => r.start_time },
    { key: 'clock_in', label: 'Clock In', render: (r: Shift) => (
      <span style={{ color: r.clock_in ? 'inherit' : 'var(--text-muted)' }}>
        {fmtTime(r.clock_in)}
        {r.late_minutes != null && r.late_minutes > 0 && (
          <span style={{ color: '#d97706', fontSize: 11, marginLeft: 4 }}>+{r.late_minutes}m</span>
        )}
      </span>
    )},
    { key: 'clock_out', label: 'Clock Out', render: (r: Shift) => fmtTime(r.clock_out) },
    { key: 'end_time', label: 'Sched Out', render: (r: Shift) => r.end_time ?? '—' },
    { key: 'hours', label: 'Hours', render: (r: Shift) => calcHours(r.start_time, r.end_time) },
    { key: 'status', label: 'Status', render: (r: Shift) => (
      <span style={{
        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        background: `${STATUS_COLOR[r.status] ?? '#64748b'}22`,
        color: STATUS_COLOR[r.status] ?? '#64748b',
        textTransform: 'uppercase',
      }}>
        {r.status}
      </span>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Shifts & Attendance"
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
            {isHR && (
              <Btn variant="ghost" size="sm" loading={markAbsentMut.isPending} onClick={() => markAbsentMut.mutate()}>
                <UserX size={13} /> Mark Absent
              </Btn>
            )}
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Log Shift</Btn>
          </>
        }
      />

      {/* Attendance Summary */}
      {attendanceData && attendanceData.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {(['present', 'late', 'absent'] as const).map(st => (
            <div key={st} style={{
              background: 'var(--surface)', border: `2px solid ${STATUS_COLOR[st]}44`,
              borderRadius: 10, padding: '10px 20px', textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: STATUS_COLOR[st] }}>
                {summary[st] ?? 0}
              </div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: STATUS_COLOR[st], fontWeight: 700 }}>
                {st}
              </div>
            </div>
          ))}
        </div>
      )}

      {markAbsentMsg && <Alert type="success" message={markAbsentMsg} />}

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>
      <CreateShiftModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
