import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { wmsApi, hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { CheckTask } from '../../types';

function GenerateCheckModal({ soId, soNumber, open, onClose }: { soId: string; soNumber: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [assignedTo, setAssignedTo] = useState('');
  const [err, setErr] = useState('');
  const { data: employees } = useQuery({ queryKey: ['employees-checker'], queryFn: () => hrisApi.employees({ role: 'checker', limit: '50' }) });

  const mut = useMutation({
    mutationFn: () => wmsApi.generateCheckTasks(soId, assignedTo || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['check-tasks'] }); onClose(); setErr(''); },
    onError: (e) => setErr(apiError(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Generate Check Tasks — ${soNumber}`}>
      {err && <Alert type="error" message={err} />}
      <Field label="Assign to checker (optional)">
        <Select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
          <option value="">— Unassigned —</option>
          {(employees?.data ?? []).map(e => <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>)}
        </Select>
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} onClick={() => mut.mutate()}>Generate</Btn>
      </div>
    </Modal>
  );
}

export function CheckTasksPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [genTarget, setGenTarget] = useState<{ soId: string; soNumber: string } | null>(null);

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
    { key: 'qty_checked', label: 'Checked' },
    { key: 'status', label: 'Status', render: (r: CheckTask) => <Badge status={r.status} /> },
    { key: 'checker_name', label: 'Checker', render: (r: CheckTask) => r.checker_name ?? '—' },
    { key: 'notes', label: 'Notes', render: (r: CheckTask) => r.notes ?? '—' },
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
        {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>

      {genTarget && (
        <GenerateCheckModal
          soId={genTarget.soId}
          soNumber={genTarget.soNumber}
          open
          onClose={() => setGenTarget(null)}
        />
      )}
    </div>
  );
}
