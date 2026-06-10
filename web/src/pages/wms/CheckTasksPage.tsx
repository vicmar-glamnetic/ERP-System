import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { wmsApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { CheckTask } from '../../types';

function CheckTaskModal({ task, open, onClose }: { task: CheckTask | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [qtyChecked, setQtyChecked] = useState('');
  const [failNotes, setFailNotes] = useState('');
  const [mode, setMode] = useState<'idle' | 'fail'>('idle');
  const [err, setErr] = useState('');

  const reset = () => { setQtyChecked(''); setFailNotes(''); setMode('idle'); setErr(''); };

  const passMut = useMutation({
    mutationFn: () => wmsApi.confirmCheckTask(task!.id, parseFloat(qtyChecked)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['check-tasks'] }); onClose(); reset(); },
    onError: (e) => setErr(apiError(e)),
  });

  const failMut = useMutation({
    mutationFn: () => wmsApi.failCheckTask(task!.id, failNotes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['check-tasks'] }); onClose(); reset(); },
    onError: (e) => setErr(apiError(e)),
  });

  if (!task) return null;

  const alreadyDone = task.status !== 'pending';

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title={`Check Task — ${task.so_number}`} width={480}>
      {err && <Alert type="error" message={err} />}

      {/* Task summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          ['Product', `${task.product_sku} — ${task.product_name}`],
          ['Customer', task.customer_name],
          ['Expected Qty', String(task.qty_expected)],
          ['Status', null],
        ].map(([label, value]) => (
          <div key={label as string} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
              {label as string}
            </div>
            {label === 'Status'
              ? <Badge status={task.status} />
              : <div style={{ fontWeight: 600, fontSize: 13 }}>{value as string}</div>}
          </div>
        ))}
      </div>

      {alreadyDone ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          This task has already been <strong>{task.status}</strong>.
          {task.notes && <div style={{ marginTop: 6, fontStyle: 'italic' }}>Notes: {task.notes}</div>}
        </div>
      ) : (
        <>
          {mode !== 'fail' && (
            <>
              <Field label="Qty Checked">
                <Input
                  type="number"
                  min={0}
                  max={task.qty_expected}
                  placeholder={`Expected: ${task.qty_expected}`}
                  value={qtyChecked}
                  onChange={e => setQtyChecked(e.target.value)}
                  autoFocus
                />
              </Field>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Btn
                  style={{ flex: 1, background: '#16a34a', borderColor: '#16a34a' }}
                  loading={passMut.isPending}
                  disabled={!qtyChecked}
                  onClick={() => passMut.mutate()}
                >
                  <CheckCircle size={14} /> Pass
                </Btn>
                <Btn
                  variant="ghost"
                  style={{ flex: 1, color: '#dc2626', borderColor: '#dc2626' }}
                  onClick={() => setMode('fail')}
                >
                  <XCircle size={14} /> Fail
                </Btn>
              </div>
            </>
          )}

          {mode === 'fail' && (
            <>
              <Field label="Reason for failure (required)">
                <textarea
                  value={failNotes}
                  onChange={e => setFailNotes(e.target.value)}
                  placeholder="e.g. Qty mismatch, damaged packaging..."
                  rows={3}
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                    border: '1px solid #dc2626', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'inherit', color: 'var(--text)',
                  }}
                />
              </Field>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Btn variant="ghost" onClick={() => { setMode('idle'); setErr(''); }} style={{ flex: 1 }}>
                  Back
                </Btn>
                <Btn
                  loading={failMut.isPending}
                  disabled={!failNotes.trim()}
                  onClick={() => failMut.mutate()}
                  style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <XCircle size={14} /> Confirm Fail
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

export function CheckTasksPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<CheckTask | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['check-tasks', statusFilter],
    queryFn: () => wmsApi.checkTasks(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'so_number', label: 'SO #', render: (r: CheckTask) => <strong>{r.so_number}</strong> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'product_sku', label: 'SKU' },
    { key: 'product_name', label: 'Product' },
    { key: 'qty_expected', label: 'Expected' },
    { key: 'qty_checked', label: 'Checked', render: (r: CheckTask) => r.qty_checked ?? '—' },
    { key: 'status', label: 'Status', render: (r: CheckTask) => <Badge status={r.status} /> },
    { key: 'checker_name', label: 'Checker', render: (r: CheckTask) => r.checker_name ?? '—' },
    {
      key: 'action', label: '',
      render: (r: CheckTask) => r.status === 'pending' ? (
        <Btn size="sm" onClick={e => { e.stopPropagation(); setSelected(r); }}>
          Check
        </Btn>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Check Tasks"
        sub="Checker verification tasks for packed SOs"
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {['', 'pending', 'passed', 'failed'].map(s => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
          </>
        }
      />

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} onRow={r => setSelected(r)} />}
      </div>

      <CheckTaskModal task={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
