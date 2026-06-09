import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { tmsApi } from '../../api';
import { Table, Btn, PageHeader, Spinner } from '../../components/ui';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-PH').format(n);
}

export function FuelLogsPage() {
  const [dateFilter, setDateFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fuel-logs', dateFilter],
    queryFn: () => tmsApi.fuelLogs(dateFilter ? { date: dateFilter } : {}),
  });

  const cols = [
    { key: 'logged_at', label: 'Date', render: (r: any) => r.logged_at ? new Date(r.logged_at).toLocaleDateString('en-PH') : '—' },
    { key: 'driver_name', label: 'Driver', render: (r: any) => <strong>{r.driver_name}</strong> },
    { key: 'plate_number', label: 'Vehicle' },
    { key: 'liters', label: 'Liters', render: (r: any) => `${parseFloat(r.liters).toFixed(2)} L` },
    { key: 'distance_km', label: 'Distance', render: (r: any) => r.distance_km ? `${fmt(r.distance_km)} km` : '—' },
    {
      key: 'efficiency', label: 'Efficiency', render: (r: any) => {
        if (!r.distance_km || !r.liters) return '—';
        const eff = parseFloat(r.distance_km) / parseFloat(r.liters);
        return `${eff.toFixed(2)} km/L`;
      }
    },
    { key: 'notes', label: 'Notes', render: (r: any) => r.notes || '—' },
    { key: 'logged_at', label: 'Logged At', render: (r: any) => r.logged_at ? new Date(r.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—' },
  ];

  const logs = data ?? [];
  const totalLiters = logs.reduce((s: number, r: any) => s + parseFloat(r.liters || 0), 0);

  return (
    <div>
      <PageHeader
        title="Fuel Logs"
        sub={`${logs.length} entries · ${totalLiters.toFixed(2)} L total`}
        actions={
          <>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
            />
            <Btn variant="ghost" size="sm" onClick={() => { setDateFilter(''); refetch(); }}> Clear</Btn>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={logs} />}
      </div>
    </div>
  );
}
