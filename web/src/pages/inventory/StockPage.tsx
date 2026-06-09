import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { inventoryApi } from '../../api';
import { Table, Btn, PageHeader, Spinner } from '../../components/ui';
import type { InventoryRow } from '../../types';

export function StockPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStock, setLowStock] = useState(false);

  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: inventoryApi.warehouses });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stock', warehouseFilter, lowStock],
    queryFn: () => inventoryApi.stock({
      ...(warehouseFilter ? { warehouse_id: warehouseFilter } : {}),
      ...(lowStock ? { low_stock: 'true' } : {}),
    }),
  });

  const rows: InventoryRow[] = data ?? [];

  const cols = [
    { key: 'sku', label: 'SKU', render: (r: InventoryRow) => <strong>{r.sku}</strong> },
    { key: 'product_name', label: 'Product' },
    { key: 'warehouse_code', label: 'Warehouse' },
    { key: 'bin_code', label: 'Bin', render: (r: InventoryRow) => r.bin_code ?? '—' },
    {
      key: 'qty_on_hand', label: 'On Hand', render: (r: InventoryRow) => {
        const isLow = r.reorder_point != null && r.qty_on_hand <= r.reorder_point;
        return (
          <span style={{ color: isLow ? 'var(--danger)' : undefined, fontWeight: isLow ? 700 : undefined, display: 'flex', gap: 4, alignItems: 'center' }}>
            {isLow && <AlertTriangle size={12} />}
            {r.qty_on_hand}
          </span>
        );
      }
    },
    { key: 'qty_reserved', label: 'Reserved' },
    { key: 'qty_available', label: 'Available', render: (r: InventoryRow) => <strong>{r.qty_available}</strong> },
    { key: 'uom', label: 'UOM' },
    { key: 'reorder_point', label: 'Reorder At', render: (r: InventoryRow) => r.reorder_point ?? '—' },
  ];

  const lowStockCount = rows.filter(r => r.reorder_point != null && r.qty_on_hand <= r.reorder_point).length;

  return (
    <div>
      <PageHeader
        title="Stock Levels"
        sub={`${rows.length} inventory entries${lowStockCount > 0 ? ` · ${lowStockCount} low stock` : ''}`}
        actions={
          <>
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

      {lowStockCount > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <AlertTriangle size={15} style={{ color: '#D97706' }} />
          <strong style={{ color: '#92400E' }}>{lowStockCount} product{lowStockCount !== 1 ? 's' : ''} at or below reorder point</strong>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={rows} />}
      </div>
    </div>
  );
}
