import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Employee } from '../../types';

const ROLES = ['system_admin', 'wh_supervisor', 'wh_operator', 'driver', 'dispatcher', 'checker', 'finance_officer', 'hr_manager', 'hr_staff', 'branch_manager'];

function CreateEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_code: '', full_name: '', email: '', role: 'wh_operator',
    department: '', position: '', hire_date: '', password: '',
  });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => hrisApi.createEmployee({
      employee_code: form.employee_code,
      full_name: form.full_name,
      email: form.email || undefined,
      role: form.role,
      department: form.department || undefined,
      position: form.position || undefined,
      hire_date: form.hire_date || undefined,
      password: form.password,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
      setForm({ employee_code: '', full_name: '', email: '', role: 'wh_operator', department: '', position: '', hire_date: '', password: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Employee" width={560}>
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Field label="Employee Code">
          <Input value={form.employee_code} onChange={set('employee_code')} placeholder="EMP-001" />
        </Field>
        <Field label="Full Name">
          <Input value={form.full_name} onChange={set('full_name')} placeholder="Juan Dela Cruz" />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="juan@company.com" />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={set('role')}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Department">
          <Input value={form.department} onChange={set('department')} placeholder="Warehouse" />
        </Field>
        <Field label="Position">
          <Input value={form.position} onChange={set('position')} placeholder="Picker" />
        </Field>
        <Field label="Hire Date">
          <Input type="date" value={form.hire_date} onChange={set('hire_date')} />
        </Field>
        <Field label="Password">
          <Input type="password" value={form.password} onChange={set('password')} placeholder="Initial password" />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.employee_code || !form.full_name || !form.password} onClick={() => mut.mutate()}>
          Create Employee
        </Btn>
      </div>
    </Modal>
  );
}

export function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employees', roleFilter, search],
    queryFn: () => hrisApi.employees({
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(search ? { search } : {}),
      limit: '100',
    }),
  });

  const cols = [
    { key: 'employee_code', label: 'Code', render: (r: Employee) => <strong>{r.employee_code}</strong> },
    { key: 'full_name', label: 'Name' },
    { key: 'role', label: 'Role', render: (r: Employee) => <Badge status={r.role} /> },
    { key: 'department', label: 'Dept', render: (r: Employee) => r.department || '—' },
    { key: 'position', label: 'Position', render: (r: Employee) => r.position || '—' },
    { key: 'email', label: 'Email', render: (r: Employee) => r.email || '—' },
    { key: 'hire_date', label: 'Hired', render: (r: Employee) => r.hire_date ? new Date(r.hire_date).toLocaleDateString('en-PH') : '—' },
    { key: 'status', label: 'Status', render: (r: Employee) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        sub={`${data?.data?.length ?? 0} employees`}
        actions={
          <>
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 160 }} />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Add Employee</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data?.data ?? []} />}
      </div>
      <CreateEmployeeModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
