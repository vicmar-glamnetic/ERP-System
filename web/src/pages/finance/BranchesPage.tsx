import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { financeApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Branch } from '../../types';

function CreateBranchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', address: '', contact_person: '', contact_number: '' });
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => financeApi.createBranch({
      code: form.code,
      name: form.name,
      address: form.address || undefined,
      contact_person: form.contact_person || undefined,
      contact_number: form.contact_number || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      onClose();
      setForm({ code: '', name: '', address: '', contact_person: '', contact_number: '' });
      setErr('');
    },
    onError: (e) => setErr(apiError(e)),
  });

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Branch">
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <Field label="Branch Code">
          <Input value={form.code} onChange={set('code')} placeholder="BR-003" />
        </Field>
        <Field label="Branch Name">
          <Input value={form.name} onChange={set('name')} placeholder="Cebu Branch" />
        </Field>
      </div>
      <Field label="Address">
        <Input value={form.address} onChange={set('address')} placeholder="Full address" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Contact Person">
          <Input value={form.contact_person} onChange={set('contact_person')} placeholder="Full name" />
        </Field>
        <Field label="Contact Number">
          <Input value={form.contact_number} onChange={set('contact_number')} placeholder="+63 9XX XXX XXXX" />
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!form.code || !form.name} onClick={() => mut.mutate()}>
          Create Branch
        </Btn>
      </div>
    </Modal>
  );
}

export function BranchesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => financeApi.branches(),
  });

  const cols = [
    { key: 'code', label: 'Code', render: (r: Branch) => <strong>{r.code}</strong> },
    { key: 'name', label: 'Branch Name' },
    { key: 'address', label: 'Address', render: (r: Branch) => r.address || '—' },
    { key: 'contact_person', label: 'Contact', render: (r: Branch) => r.contact_person || '—' },
    { key: 'contact_number', label: 'Phone', render: (r: Branch) => r.contact_number || '—' },
    { key: 'status', label: 'Status', render: (r: Branch) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Branches"
        sub={`${data?.length ?? 0} branches`}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> Add Branch</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} />}
      </div>
      <CreateBranchModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
