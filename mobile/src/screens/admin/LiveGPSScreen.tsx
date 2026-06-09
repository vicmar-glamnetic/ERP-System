import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getLiveGPS, LiveGPSEntry } from '../../api/tms';
import { COLORS } from '../../constants';

function buildLeafletHTML(drivers: LiveGPSEntry[]): string {
  const markersJs = drivers
    .map(
      (d) => `
        L.marker([${d.latitude}, ${d.longitude}])
          .addTo(map)
          .bindPopup(
            '<b>${d.driver_name}</b><br>' +
            '🚛 ${d.plate_number}<br>' +
            '⚡ ${d.speed_kmh.toFixed(1)} km/h<br>' +
            '🕐 ${new Date(d.logged_at).toLocaleTimeString()}'
          )
          .openPopup();
      `
    )
    .join('');

  const center =
    drivers.length > 0
      ? `[${drivers[0].latitude}, ${drivers[0].longitude}]`
      : '[10.3157, 123.8854]'; // Cebu City default

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    body, html { margin:0; padding:0; height:100%; }
    #map { height:100vh; width:100vw; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView(${center}, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    ${markersJs}
  </script>
</body>
</html>
  `;
}

export function LiveGPSScreen() {
  const [drivers, setDrivers] = useState<LiveGPSEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapView, setMapView] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getLiveGPS();
      setDrivers(data);
    } catch {
      // ignore — could be offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mapView && styles.toggleActive]}
          onPress={() => setMapView(true)}
        >
          <Text style={[styles.toggleText, mapView && styles.toggleTextActive]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !mapView && styles.toggleActive]}
          onPress={() => setMapView(false)}
        >
          <Text style={[styles.toggleText, !mapView && styles.toggleTextActive]}>
            List ({drivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {drivers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>No Active Drivers</Text>
          <Text style={styles.emptyText}>No routes are currently in progress.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load()}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : mapView ? (
        <WebView
          source={{ html: buildLeafletHTML(drivers) }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
        />
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(d) => d.route_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item: d }) => (
            <View style={styles.driverCard}>
              <View style={styles.driverRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{d.driver_name[0]}</Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{d.driver_name}</Text>
                  <Text style={styles.driverMeta}>🚛 {d.plate_number}</Text>
                </View>
                <View style={styles.speedBadge}>
                  <Text style={styles.speedText}>{d.speed_kmh.toFixed(0)} km/h</Text>
                </View>
              </View>
              <View style={styles.coordRow}>
                <Text style={styles.coordText}>
                  {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
                </Text>
                <Text style={styles.timeText}>Updated {formatTime(d.logged_at)}</Text>
              </View>
            </View>
          )}
        />
      )}

      {drivers.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} active · auto-refreshes every 30s
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.white },
  map: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20 },
  refreshBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  refreshText: { color: COLORS.white, fontWeight: '700' },
  driverCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  driverMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  speedBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  speedText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  coordRow: { flexDirection: 'row', justifyContent: 'space-between' },
  coordText: { fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace' },
  timeText: { fontSize: 11, color: COLORS.textMuted },
  footer: {
    backgroundColor: COLORS.card,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  footerText: { fontSize: 11, color: COLORS.textMuted },
});
