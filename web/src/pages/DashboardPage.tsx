import { useQuery } from '@tanstack/react-query';
import { Package, ShoppingCart, Truck, TrendingUp, TrendingDown } from 'lucide-react';
import { financeApi, wmsApi, tmsApi } from '../api';
import { KpiCard, Card, Spinner, Badge } from '../components/ui';

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
}

export function DashboardPage() {
  const { data: arSummary, isLoading: arLoading } = useQuery({
    queryKey: ['ar-summary'], queryFn: financeApi.arSummary, refetchInterval: 30000,
  });
  const { data: apSummary, isLoading: apLoading } = useQuery({
    queryKey: ['ap-summary'], queryFn: financeApi.apSummary, refetchInterval: 30000,
  });
  const { data: soData } = useQuery({
    queryKey: ['sos-dashboard'],
    queryFn: () => wmsApi.sos({ limit: '5', status: 'pending' }),
  });
  const { data: routeData } = useQuery({
    queryKey: ['routes-dashboard'],
    queryFn: () => tmsApi.routes({ limit: '5' }),
  });
  const { data: invoices } = useQuery({
    queryKey: ['invoices-dashboard'],
    queryFn: () => wmsApi.invoices({ limit: '5' }),
  });

  const isLoading = arLoading || apLoading;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <KpiCard
              label="AR Outstanding"
              value={fmt(arSummary?.total_outstanding ?? 0)}
              sub={`${arSummary?.unpaid_count ?? 0} unpaid invoices`}
              color="var(--primary)"
              icon={<TrendingUp size={18} />}
            />
            <KpiCard
              label="AP Outstanding"
              value={fmt(apSummary?.total_outstanding ?? 0)}
              sub={`${(apSummary?.unpaid_count ?? 0) + (apSummary?.partial_count ?? 0)} unpaid/partial invoices`}
              color="var(--warning)"
              icon={<TrendingDown size={18} />}
            />
            <KpiCard
              label="AR Collected"
              value={fmt(arSummary?.total_collected ?? 0)}
              sub="Total payments received"
              color="var(--success)"
              icon={<TrendingUp size={18} />}
            />
            <KpiCard
              label="AP Paid"
              value={fmt(apSummary?.total_paid ?? 0)}
              sub="Total paid to suppliers"
              color="var(--info)"
              icon={<TrendingDown size={18} />}
            />
            {apSummary?.overdue_amount > 0 && (
              <KpiCard
                label="AP Overdue"
                value={fmt(apSummary.overdue_amount)}
                sub="Past due date"
                color="var(--danger)"
                icon={<TrendingDown size={18} />}
              />
            )}
          </div>

          {/* Two-column lower section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Pending SOs */}
            <Card>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={15} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Pending Sales Orders</span>
              </div>
              <div>
                {(soData?.data ?? []).length === 0 ? (
                  <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No pending orders</div>
                ) : (soData?.data ?? []).map((so) => (
                  <div key={so.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{so.so_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{so.customer_name}</div>
                    </div>
                    <Badge status={so.status} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Routes */}
            <Card>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={15} color="var(--secondary)" />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Recent Routes</span>
              </div>
              <div>
                {(routeData ?? []).length === 0 ? (
                  <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No routes yet</div>
                ) : (routeData ?? []).map((r) => (
                  <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(r.route_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {r.plate_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.driver_name}</div>
                    </div>
                    <Badge status={r.status} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Invoices */}
            <Card style={{ gridColumn: '1 / -1' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={15} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Recent Sales Invoices</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Invoice #', 'Customer', 'Amount', 'Status', 'Date'].map((h) => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices ?? []).length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>No invoices yet</td></tr>
                    ) : (invoices ?? []).map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{inv.si_number}</td>
                        <td style={{ padding: '10px 14px' }}>{inv.customer_name}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                        <td style={{ padding: '10px 14px' }}><Badge status={inv.payment_status} /></td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {new Date(inv.issued_at).toLocaleDateString('en-PH')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
