import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { wmsApi, financeApi, hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { SalesOrder } from '../../types';

function CreateSOModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product_id: '', qty_ordered: 1 }]);
  const [err, setErr] = useState('');

  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => import('../../api').then(m => m.inventoryApi.products(1, 200)) });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => financeApi.branches() });

  const mut = useMutation({
    mutationFn: () => wmsApi.createSO({ customer_name: customerName, branch_id: branchId || undefined, required_date: requiredDate || undefined, notes: notes || undefined, lines: lines.filter(l => l.product_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sos'] }); onClose(); resetForm(); },
    onError: (e) => setErr(apiError(e)),
  });

  const resetForm = () => { setCustomerName(''); setBranchId(''); setRequiredDate(''); setNotes(''); setLines([{ product_id: '', qty_ordered: 1 }]); setErr(''); };

  return (
    <Modal open={open} onClose={onClose} title="Create Sales Order" width={560}>
      {err && <Alert type="error" message={err} />}
      <Field label="Customer Name">
        <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer / branch name" />
      </Field>
      <Field label="Branch (optional)">
        <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
          <option value="">— No branch —</option>
          {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </Select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Required Date">
          <Input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Line Items</div>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select value={line.product_id} onChange={e => { const l = [...lines]; l[i].product_id = e.target.value; setLines(l); }}>
              <option value="">— Product —</option>
              {(products?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
            <Input type="number" min={1} value={line.qty_ordered} onChange={e => { const l = [...lines]; l[i].qty_ordered = parseInt(e.target.value) || 1; setLines(l); }} />
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        ))}
        <Btn variant="ghost" size="sm" onClick={() => setLines([...lines, { product_id: '', qty_ordered: 1 }])}>
          <Plus size={12} /> Add Line
        </Btn>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} onClick={() => mut.mutate()}>Create SO</Btn>
      </div>
    </Modal>
  );
}

function GeneratePickTasksModal({ so, open, onClose }: { so: SalesOrder | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [assignedTo, setAssignedTo] = useState('');
  const [err, setErr] = useState('');
  const { data: employees } = useQuery({ queryKey: ['employees-wms'], queryFn: () => hrisApi.employees({ role: 'wh_operator', limit: '50' }) });

  const mut = useMutation({
    mutationFn: () => wmsApi.generatePickTasks(so!.id, assignedTo || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sos'] }); onClose(); setErr(''); },
    onError: (e) => setErr(apiError(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Generate Pick Tasks — ${so?.so_number}`}>
      {err && <Alert type="error" message={err} />}
      <Field label="Assign to operator (optional)">
        <Select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
          <option value="">— Unassigned —</option>
          {(employees?.data ?? []).map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>)}
        </Select>
      </Field>
      {(employees?.data?.length ?? 0) === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          No warehouse operators found. You can generate tasks unassigned and assign them later via HRIS.
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} onClick={() => mut.mutate()}>Generate</Btn>
      </div>
    </Modal>
  );
}

export function SalesOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [pickTarget, setPickTarget] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sos', statusFilter],
    queryFn: () => wmsApi.sos(statusFilter ? { status: statusFilter } : {}),
  });

  const dispatchMut = useMutation({
    mutationFn: (so_id: string) => wmsApi.dispatch(so_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos'] }),
  });

  const cols = [
    { key: 'so_number', label: 'SO #', render: (r: SalesOrder) => <strong>{r.so_number}</strong> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'status', label: 'Status', render: (r: SalesOrder) => <Badge status={r.status} /> },
    { key: 'required_date', label: 'Required', render: (r: SalesOrder) => r.required_date ? new Date(r.required_date).toLocaleDateString('en-PH') : '—' },
    { key: 'lines_count', label: 'Lines' },
    { key: 'created_at', label: 'Created', render: (r: SalesOrder) => new Date(r.created_at).toLocaleDateString('en-PH') },
    {
      key: 'actions', label: 'Actions',
      render: (r: SalesOrder) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {r.status === 'pending' && (
            <Btn size="sm" onClick={(e) => { e.stopPropagation(); setPickTarget(r); }}>Pick</Btn>
          )}
          {(['checked', 'invoiced', 'ready_to_dispatch'].includes(r.status)) && (
            <Btn size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); dispatchMut.mutate(r.id); }}>
              Dispatch
            </Btn>
          )}
        </div>
      ),
    },
  ];

  const statuses = ['', 'pending', 'picking', 'packed', 'checking', 'checked', 'invoiced', 'dispatched'];

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        sub={`${data?.data?.length ?? 0} orders`}
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {statuses.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New SO</Btn>
          </>
        }
      />

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : (
          <Table cols={cols} rows={data?.data ?? []} />
        )}
      </div>

      <CreateSOModal open={showCreate} onClose={() => setShowCreate(false)} />
      <GeneratePickTasksModal so={pickTarget} open={!!pickTarget} onClose={() => setPickTarget(null)} />
    </div>
  );
}
