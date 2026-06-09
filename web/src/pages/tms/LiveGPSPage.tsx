import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, List, Map } from 'lucide-react';
import { tmsApi } from '../../api';
import { Btn, Spinner } from '../../components/ui';
import type { LiveGPS } from '../../types';

function buildLeafletHTML(drivers: LiveGPS[]): string {
  const markers = drivers.map(d => `
    L.marker([${d.latitude}, ${d.longitude}])
      .addTo(map)
      .bindPopup('<b>${d.driver_name}</b><br>🚛 ${d.plate_number}<br>⚡ ${d.speed_kmh.toFixed(1)} km/h<br>🕐 ${new Date(d.logged_at).toLocaleTimeString()}')
      .openPopup();
  `).join('');

  const center = drivers.length > 0 ? `[${drivers[0].latitude}, ${drivers[0].longitude}]` : '[10.3157, 123.8854]';

  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <style>body,html{margin:0;height:100%}#map{height:100vh}</style>
  </head><body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map').setView(${center}, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
      ${markers}
    </script>
  </body></html>`;
}

export function LiveGPSPage() {
  const [mapView, setMapView] = useState(true);
  const { data: drivers = [], isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['live-gps'],
    queryFn: tmsApi.liveGPS,
    refetchInterval: 30000,
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div style={{ height: 'calc(100vh - var(--header-h) - 48px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Live GPS</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {drivers.length} active driver{drivers.length !== 1 ? 's' : ''} · Last updated {lastRefresh}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setMapView(true)} style={{ padding: '6px 12px', background: mapView ? 'var(--primary)' : 'var(--surface)', color: mapView ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}>
              <Map size={13} /> Map
            </button>
            <button onClick={() => setMapView(false)} style={{ padding: '6px 12px', background: !mapView ? 'var(--primary)' : 'var(--surface)', color: !mapView ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}>
              <List size={13} /> List
            </button>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={13} /></Btn>
        </div>
      </div>

      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner size={32} /></div>
      ) : drivers.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>No Active Drivers</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>No routes are currently in progress.</div>
        </div>
      ) : mapView ? (
        <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <iframe
            srcDoc={buildLeafletHTML(drivers)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Live GPS Map"
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {drivers.map((d) => (
            <div key={d.route_id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 16, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>
                  {d.driver_name[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.driver_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🚛 {d.plate_number}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                    {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: 'var(--success-bg)', color: 'var(--success)', fontWeight: 700, fontSize: 13, padding: '4px 10px', borderRadius: 20 }}>
                  {d.speed_kmh.toFixed(0)} km/h
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(d.logged_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
