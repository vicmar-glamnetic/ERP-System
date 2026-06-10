import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, Package, TrendingDown, XCircle, Search } from 'lucide-react';
import { inventoryApi } from '../../api';
import { Btn, PageHeader, Spinner } from '../../components/ui';
import type { InventoryRow } from '../../types';

function StockStatus({ row }: { row: InventoryRow }) {
  const qty = row.qty_on_hand;
  const reorder = row.reorder_point;
  if (qty === 0) return <span style={pill('#FEE2E2', '#B91C1C')}>Out of Stock</span>;
  if (reorder != null && qty <= reorder) return <span style={pill('#FEF3C7', '#D97706')}>Low Stock</span>;
  return <span style={pill('#DCFCE7', '#15803D')}>In Stock</span>;
}

function pill(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const };
}

function BinTag({ row }: { row: InventoryRow }) {
  const bin = row.bin_code ?? (row.aisle ? `${row.aisle}-${row.bay}-${row.level}` : null);
  if (!bin) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  return (
    <span style={{
      background: 'var(--primary-light, #E8F4F0)', color: 'var(--primary, #0F6E56)',
      borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, fontFamily: 'monospace',
    }}>
      {bin}
    </span>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1,
    }}>
      <div style={{ background: color + '18', borderRadius: 8, padding: 10, color, display: 'flex' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

export function StockPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [search, setSearch] = useState('');

  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: inventoryApi.warehouses });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stock', warehouseFilter, lowStock],
    queryFn: () => inventoryApi.stock({
      ...(warehouseFilter ? { warehouse_id: warehouseFilter } : {}),
      ...(lowStock ? { low_stock: 'true' } : {}),
    }),
  });

  const allRows: InventoryRow[] = data ?? [];

  const rows = search.trim()
    ? allRows.filter(r =>
        r.sku.toLowerCase().includes(search.toLowerCase()) ||
        (r.product_name ?? r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.bin_code ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allRows;

  const inStock = rows.filter(r => r.qty_on_hand > 0 && (r.reorder_point == null || r.qty_on_hand > r.reorder_point)).length;
  const lowCount = rows.filter(r => r.reorder_point != null && r.qty_on_hand > 0 && r.qty_on_hand <= r.reorder_point).length;
  const outCount = rows.filter(r => r.qty_on_hand === 0).length;

  return (
    <div>
      <PageHeader
        title="Stock Levels"
        sub={`${allRows.length} inventory entries`}
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search SKU, product, bin…"
                style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, width: 200 }}
              />
            </div>
            <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              <option value="">All Warehouses</option>
              {(warehouses ?? []).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} />
              Low Stock Only
            </label>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
          </>
        }
      />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <SummaryCard icon={<Package size={18} />} label="In Stock" value={inStock} color="#0F6E56" />
        <SummaryCard icon={<TrendingDown size={18} />} label="Low Stock" value={lowCount} color="#D97706" />
        <SummaryCard icon={<XCircle size={18} />} label="Out of Stock" value={outCount} color="#B91C1C" />
      </div>

      {lowCount > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <AlertTriangle size={15} style={{ color: '#D97706' }} />
          <strong style={{ color: '#92400E' }}>{lowCount} product{lowCount !== 1 ? 's' : ''} at or below reorder point</strong>
        </div>
      )}

      {/* Stock table */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            {search ? 'No results match your search.' : 'No inventory records found.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                {['SKU', 'Product', 'Warehouse', 'Bin', 'Status', 'On Hand', 'Reserved', 'Available', 'UOM', 'Reorder At'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.bin_id ?? r.product_id + i} style={{ borderBottom: '1px solid var(--border)', background: r.qty_on_hand === 0 ? '#FFF5F5' : i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{r.sku}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{r.product_name ?? r.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.warehouse_code ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}><BinTag row={r} /></td>
                  <td style={{ padding: '10px 14px' }}><StockStatus row={r} /></td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: r.qty_on_hand === 0 ? '#B91C1C' : 'var(--text)' }}>{r.qty_on_hand}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.qty_reserved ?? 0}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary, #0F6E56)' }}>{r.qty_available ?? r.qty_on_hand}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.uom}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.reorder_point ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
