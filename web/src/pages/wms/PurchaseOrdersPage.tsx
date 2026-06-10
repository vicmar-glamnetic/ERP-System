import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Package, ClipboardList } from 'lucide-react';
import { wmsApi, inventoryApi, hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { PurchaseOrder, GRNLog, PutawayTask } from '../../types';

// ── Create PO Modal ───────────────────────────────────────────────────────────

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

// ── Generate Putaway Modal ────────────────────────────────────────────────────

function GeneratePutawayModal({ po, open, onClose }: { po: PurchaseOrder; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedGrn, setSelectedGrn] = useState<Set<string>>(new Set());
  const [assignedTo, setAssignedTo] = useState('');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const { data: grnLogs, isLoading: grnLoading } = useQuery({
    queryKey: ['grn-logs', po.id],
    queryFn: () => wmsApi.grnLogs(po.id),
    enabled: open,
  });

  const { data: operators } = useQuery({
    queryKey: ['employees-operators'],
    queryFn: () => hrisApi.employees({ role: 'wh_operator', limit: '100' }),
    enabled: open,
  });

  const unassigned = (grnLogs ?? []).filter((g: GRNLog & { has_active_putaway?: boolean }) => !g.has_active_putaway);

  const toggleGrn = (id: string) => {
    const next = new Set(selectedGrn);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedGrn(next);
  };

  const toggleAll = () => {
    if (selectedGrn.size === unassigned.length) setSelectedGrn(new Set());
    else setSelectedGrn(new Set(unassigned.map(g => g.id)));
  };

  const mut = useMutation({
    mutationFn: () => wmsApi.generatePutawayTasks([...selectedGrn], assignedTo),
    onSuccess: (data: PutawayTask[]) => {
      const emp = (operators?.data ?? []).find(e => e.id === assignedTo);
      setSuccess(`${data.length} putaway task${data.length !== 1 ? 's' : ''} assigned to ${emp?.full_name ?? 'operator'}`);
      setSelectedGrn(new Set());
      setAssignedTo('');
      qc.invalidateQueries({ queryKey: ['putaway-tasks'] });
      qc.invalidateQueries({ queryKey: ['grn-logs', po.id] });
    },
    onError: (e) => setErr(apiError(e)),
  });

  const handleClose = () => { setSuccess(''); setErr(''); setSelectedGrn(new Set()); setAssignedTo(''); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={`Generate Putaway Tasks — ${po.po_number}`} width={580}>
      {err && <Alert type="error" message={err} />}
      {success && <Alert type="success" message={success} />}

      {grnLoading ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div> : (
        <>
          {unassigned.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
              All GRN lines already have active putaway tasks.
            </p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    GRN Lines ({unassigned.length} unassigned)
                  </span>
                  <Btn variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedGrn.size === unassigned.length ? 'Deselect All' : 'Select All'}
                  </Btn>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {unassigned.map((grn: GRNLog & { has_active_putaway?: boolean }, i: number) => (
                    <label
                      key={grn.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        cursor: 'pointer', borderBottom: i < unassigned.length - 1 ? '1px solid var(--border)' : 'none',
                        background: selectedGrn.has(grn.id) ? 'var(--primary-light, #eff6ff)' : 'var(--surface)',
                      }}
                    >
                      <input type="checkbox" checked={selectedGrn.has(grn.id)} onChange={() => toggleGrn(grn.id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{grn.sku} — {grn.product_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Qty: {grn.qty_received}
                          {grn.lot_number ? ` · Lot: ${grn.lot_number}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="Assign to Operator">
                <Select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">— Select wh_operator —</option>
                  {(operators?.data ?? []).map(e => (
                    <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
                  ))}
                </Select>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
                <Btn
                  loading={mut.isPending}
                  disabled={selectedGrn.size === 0 || !assignedTo}
                  onClick={() => { setErr(''); mut.mutate(); }}
                >
                  <Package size={13} /> Assign {selectedGrn.size > 0 ? `${selectedGrn.size} ` : ''}Tasks
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ── Putaway Tasks Table ───────────────────────────────────────────────────────

function PutawayTasksSection() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['putaway-tasks', statusFilter],
    queryFn: () => wmsApi.putawayTasks(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'product_sku', label: 'SKU', render: (r: PutawayTask) => <strong>{r.product_sku}</strong> },
    { key: 'product_name', label: 'Product' },
    { key: 'qty', label: 'Qty', render: (r: PutawayTask) => r.qty?.toString() },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: PutawayTask) => r.warehouse_name ?? '—' },
    {
      key: 'from_bin', label: 'From Bin',
      render: (r: PutawayTask) => r.from_aisle ? `${r.from_aisle}-${r.from_bay}-${r.from_level}` : '—',
    },
    { key: 'assigned_to_name', label: 'Assigned To', render: (r: PutawayTask) => r.assigned_to_name ? `${r.assigned_to_code} · ${r.assigned_to_name}` : '—' },
    { key: 'status', label: 'Status', render: (r: PutawayTask) => <Badge status={r.status} /> },
    { key: 'completed_at', label: 'Completed', render: (r: PutawayTask) => r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-PH') : '—' },
  ];

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Putaway Tasks</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tasks?.length ?? 0} active tasks</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
          >
            {['', 'pending', 'in_progress', 'completed'].map(s => (
              <option key={s} value={s}>{s || 'Active tasks'}</option>
            ))}
          </select>
          <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : tasks?.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active putaway tasks</div>
            : <Table cols={cols} rows={tasks ?? []} />}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PurchaseOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [putawayPO, setPutawayPO] = useState<PurchaseOrder | null>(null);
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
    {
      key: 'actions', label: '',
      render: (r: PurchaseOrder) => r.status === 'received' || r.status === 'receiving' ? (
        <Btn size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setPutawayPO(r); }}>
          <ClipboardList size={12} /> Assign Putaway
        </Btn>
      ) : null,
    },
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
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data?.data ?? []} />}
      </div>

      <PutawayTasksSection />

      <CreatePOModal open={showCreate} onClose={() => setShowCreate(false)} />
      {putawayPO && (
        <GeneratePutawayModal
          po={putawayPO}
          open={!!putawayPO}
          onClose={() => setPutawayPO(null)}
        />
      )}
    </div>
  );
}
