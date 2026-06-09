import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, MapPin, Phone, Clock, Package } from 'lucide-react';
import { tmsApi, hrisApi } from '../../api';
import { Table, Badge, Btn, PageHeader, Modal, Field, Input, Select, Alert, Spinner } from '../../components/ui';
import { apiError } from '../../api/client';
import type { Route, DeliveryStop } from '../../types';

function CreateRouteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [stops, setStops] = useState([{ stop_sequence: 1, address: '', recipient_name: '', recipient_phone: '' }]);
  const [err, setErr] = useState('');

  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: tmsApi.vehicles });
  const { data: drivers } = useQuery({ queryKey: ['drivers'], queryFn: () => hrisApi.employees({ role: 'driver', limit: '50' }) });

  const mut = useMutation({
    mutationFn: () => tmsApi.createRoute({ route_date: routeDate, vehicle_id: vehicleId, driver_id: driverId, stops }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); onClose(); setVehicleId(''); setDriverId(''); setStops([{ stop_sequence: 1, address: '', recipient_name: '', recipient_phone: '' }]); setErr(''); },
    onError: (e) => setErr(apiError(e)),
  });

  const addStop = () => setStops([...stops, { stop_sequence: stops.length + 1, address: '', recipient_name: '', recipient_phone: '' }]);

  return (
    <Modal open={open} onClose={onClose} title="Create Route" width={580}>
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Route Date">
          <Input type="date" value={routeDate} onChange={e => setRouteDate(e.target.value)} />
        </Field>
        <Field label="Vehicle">
          <Select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
            <option value="">— Select —</option>
            {(vehicles ?? []).filter(v => v.status === 'available').map(v => (
              <option key={v.id} value={v.id}>{v.plate_number} ({v.type})</option>
            ))}
          </Select>
        </Field>
        <Field label="Driver">
          <Select value={driverId} onChange={e => setDriverId(e.target.value)}>
            <option value="">— Select —</option>
            {(drivers?.data ?? []).map(d => <option key={d.id} value={d.id}>{d.employee_code} — {d.full_name}</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          Delivery Stops
        </div>
        {stops.map((stop, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</div>
            <Input placeholder="Address" value={stop.address} onChange={e => { const s = [...stops]; s[i].address = e.target.value; setStops(s); }} />
            <Input placeholder="Recipient" value={stop.recipient_name} onChange={e => { const s = [...stops]; s[i].recipient_name = e.target.value; setStops(s); }} />
            <Input placeholder="Phone" value={stop.recipient_phone} onChange={e => { const s = [...stops]; s[i].recipient_phone = e.target.value; setStops(s); }} />
            <button onClick={() => setStops(stops.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        ))}
        <Btn variant="ghost" size="sm" onClick={addStop}><Plus size={12} /> Add Stop</Btn>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn loading={mut.isPending} disabled={!vehicleId || !driverId} onClick={() => mut.mutate()}>Create Route</Btn>
      </div>
    </Modal>
  );
}

function RouteDetailModal({ route, open, onClose }: { route: Route | null; open: boolean; onClose: () => void }) {
  const [podStop, setPodStop] = useState<DeliveryStop | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['route-detail', route?.id],
    queryFn: () => tmsApi.route(route!.id),
    enabled: !!route?.id,
    staleTime: 0,
  });

  const stops: DeliveryStop[] = (data as any)?.stops ?? [];
  const delivered = stops.filter(s => s.status === 'delivered').length;

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Route Detail — ${route?.route_date}`} width={660}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : data && (
          <>
            {/* Route Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Driver', data.driver_name],
                ['Vehicle', data.plate_number],
                ['Status', null],
                ['Progress', `${delivered}/${stops.length} stops`],
              ].map(([label, val]) => (
                <div key={label as string} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
                  {label === 'Status' ? <Badge status={data.status} /> : <div style={{ fontWeight: 700, fontSize: 13 }}>{val as string}</div>}
                </div>
              ))}
            </div>

            {/* Stops */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
              Delivery Stops
            </div>
            {stops.map((stop) => (
              <div key={stop.id} style={{
                border: `1px solid ${stop.status === 'delivered' ? 'var(--success)' : stop.status === 'failed' ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 10, padding: 14, marginBottom: 10,
                background: stop.status === 'delivered' ? '#F0FDF4' : stop.status === 'failed' ? '#FFF5F5' : 'var(--surface)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 11, color: 'var(--text-muted)' }}>STOP {stop.stop_sequence}</span>
                      <Badge status={stop.status} />
                      {stop.so_number && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 3, alignItems: 'center' }}>
                          <Package size={10} /> {stop.so_number}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{stop.recipient_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center', marginBottom: stop.recipient_phone ? 3 : 0 }}>
                      <MapPin size={11} /> {stop.address}
                    </div>
                    {stop.recipient_phone && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Phone size={11} /> {stop.recipient_phone}
                      </div>
                    )}
                    {stop.delivered_at && (
                      <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Clock size={10} /> Delivered {new Date(stop.delivered_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    {stop.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>"{stop.notes}"</div>
                    )}
                  </div>

                  {/* POD Photo thumbnail */}
                  {stop.pod_photo_url && (
                    <button
                      onClick={() => setPodStop(stop)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12, flexShrink: 0 }}
                    >
                      <img
                        src={stop.pod_photo_url}
                        alt="POD"
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--success)' }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--success)', textAlign: 'center', marginTop: 2, fontWeight: 700 }}>View POD</div>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {stops.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>No stops recorded.</div>
            )}
          </>
        )}
      </Modal>

      {/* Full-size POD photo lightbox */}
      {podStop && (
        <Modal open={!!podStop} onClose={() => setPodStop(null)} title={`POD Photo — Stop ${podStop.stop_sequence} · ${podStop.recipient_name}`} width={520}>
          <img src={podStop.pod_photo_url!} alt="Proof of delivery" style={{ width: '100%', borderRadius: 10, maxHeight: 480, objectFit: 'contain' }} />
          {podStop.delivered_at && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              Delivered at {new Date(podStop.delivered_at).toLocaleString('en-PH')}
            </div>
          )}
          {podStop.notes && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text)', marginTop: 6, fontStyle: 'italic' }}>"{podStop.notes}"</div>
          )}
        </Modal>
      )}
    </>
  );
}

export function RoutesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Route | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['routes', statusFilter],
    queryFn: () => tmsApi.routes(statusFilter ? { status: statusFilter } : {}),
  });

  const cols = [
    { key: 'route_date', label: 'Date', render: (r: Route) => <strong>{r.route_date}</strong> },
    { key: 'plate_number', label: 'Vehicle', render: (r: Route) => `${r.plate_number} (${r.vehicle_type})` },
    { key: 'driver_name', label: 'Driver' },
    { key: 'status', label: 'Status', render: (r: Route) => <Badge status={r.status} /> },
    { key: 'stops', label: 'Stops', render: (r: Route) => {
      const stops = r.stops ?? [];
      const done = stops.filter(s => s.status === 'delivered').length;
      return `${done}/${stops.length}`;
    }},
    { key: 'started_at', label: 'Started', render: (r: Route) => r.started_at ? new Date(r.started_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'completed_at', label: 'Completed', render: (r: Route) => r.completed_at ? new Date(r.completed_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Routes"
        sub="Click a route to view delivery details and POD photos"
        actions={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              {['', 'pending', 'in_progress', 'completed'].map(s => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
            <Btn onClick={() => setShowCreate(true)}><Plus size={13} /> New Route</Btn>
          </>
        }
      />
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : <Table cols={cols} rows={data ?? []} onRow={setSelected} />}
      </div>
      <CreateRouteModal open={showCreate} onClose={() => setShowCreate(false)} />
      <RouteDetailModal route={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
