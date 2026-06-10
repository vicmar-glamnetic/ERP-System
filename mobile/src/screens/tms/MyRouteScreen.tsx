import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { getMyRouteToday, startRoute, pingGPS } from '../../api/tms';
import { Route, DeliveryStop } from '../../types';
import { COLORS } from '../../constants';

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  in_progress: COLORS.primary,
  completed: COLORS.success,
};

export function MyRouteScreen() {
  const navigation = useNavigation<any>();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const gpsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getMyRouteToday();
      setRoute(r);
      if (r?.status === 'in_progress') beginGPS(r.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { if (gpsInterval.current) clearInterval(gpsInterval.current); };
  }, [load]);

  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const beginGPS = useCallback(async (routeId: string) => {
    if (gpsInterval.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'GPS tracking requires location access. Go to device Settings → Apps → ERP Mobile → Permissions → Location → Allow.',
        [{ text: 'OK' }]
      );
      return;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      Alert.alert(
        'Turn On Device Location',
        'Your phone\'s GPS/Location is turned off. Pull down the notification bar and tap the Location icon (or go to Settings → Location) to turn it on, then come back and tap Start Route again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setGpsActive(true);
    setGpsError(null);

    const getLocation = (): Promise<Location.LocationObject> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('GPS timeout after 20s')), 20000);
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 500, distanceInterval: 0 },
          (loc) => { clearTimeout(timer); resolve(loc); }
        ).then(sub => {
          // Remove subscription after first fix is resolved
          Promise.resolve().then(() => sub.remove());
        }).catch(reject);
      });

    const sendPing = async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setGpsError('Device GPS is OFF — turn on Location in Settings');
          return;
        }
        const loc = await getLocation();
        await pingGPS(
          routeId,
          loc.coords.latitude,
          loc.coords.longitude,
          loc.coords.speed != null ? loc.coords.speed * 3.6 : undefined
        );
        setLastPingAt(new Date());
        setGpsError(null);
      } catch (e: any) {
        const msg = e?.message ?? 'Unknown error';
        console.error('GPS ping failed', e);
        setGpsError(msg.includes('QUEUED_OFFLINE') ? 'Offline – ping queued' : `Ping failed: ${msg.slice(0, 60)}`);
      }
    };

    sendPing();
    gpsInterval.current = setInterval(sendPing, 30000);
  }, []);

  const stopGPS = useCallback(() => {
    if (gpsInterval.current) {
      clearInterval(gpsInterval.current);
      gpsInterval.current = null;
    }
    setGpsActive(false);
  }, []);

  const handleStart = async () => {
    if (!route) return;
    setStarting(true);
    try {
      await startRoute(route.id);
      const updated = { ...route, status: 'in_progress', started_at: new Date().toISOString() };
      setRoute(updated);
      beginGPS(route.id);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to start route');
    } finally {
      setStarting(false);
    }
  };

  const openStop = (stop: DeliveryStop) => {
    const pendingStops = route?.stops?.filter((s) => s.status !== 'delivered') ?? [];
    const isLastStop = pendingStops.length === 1 && pendingStops[0].id === stop.id;
    navigation.navigate('Deliver', { stop, isLastStop });
  };

  // Stop GPS and refresh when coming back from delivery
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load().then(() => {
        // If all stops delivered, stop GPS
        if (route?.status === 'completed') stopGPS();
      });
    });
    return unsubscribe;
  }, [navigation, load, route, stopGPS]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (!route) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <Text style={styles.noRouteIcon}>🚚</Text>
        <Text style={styles.noRouteTitle}>No Route Today</Text>
        <Text style={styles.noRouteText}>No route has been assigned for today.</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingStops = route.stops?.filter((s) => s.status !== 'delivered') ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={route.stops ?? []}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <View>
            {/* Route Card */}
            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <Text style={styles.routeDate}>{route.route_date}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[route.status] + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[route.status] }]}>
                    {route.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.vehicleText}>
                🚛 {route.plate_number} · {route.vehicle_type}
              </Text>
              <Text style={styles.stopsText}>
                {pendingStops.length} of {route.stops?.length ?? 0} stops remaining
              </Text>
              {gpsActive && (
                <View style={[styles.gpsIndicator, gpsError ? styles.gpsIndicatorError : undefined]}>
                  <Text style={[styles.gpsText, gpsError ? styles.gpsTextError : undefined]}>
                    {gpsError ? `⚠️ GPS: ${gpsError}` : `📡 GPS Active${lastPingAt ? ` · ${lastPingAt.toLocaleTimeString()}` : ''}`}
                  </Text>
                </View>
              )}
              {route.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.startBtn, starting && styles.btnDisabled]}
                  onPress={handleStart}
                  disabled={starting}
                >
                  {starting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.startBtnText}>▶ Start Route</Text>
                  )}
                </TouchableOpacity>
              )}
              {route.status === 'completed' && (
                <Text style={styles.completedText}>✅ Route Completed</Text>
              )}
            </View>
            <Text style={styles.stopsHeader}>Delivery Stops</Text>
          </View>
        }
        renderItem={({ item: stop, index }) => {
          const isPending = stop.status === 'pending';
          return (
            <TouchableOpacity
              style={[styles.stopCard, !isPending && styles.stopCardDone]}
              onPress={() => isPending && route.status === 'in_progress' ? openStop(stop) : null}
              activeOpacity={isPending && route.status === 'in_progress' ? 0.7 : 1}
            >
              <View style={styles.stopNumber}>
                <Text style={styles.stopNumText}>{index + 1}</Text>
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopRecipient}>{stop.recipient_name ?? 'Unknown'}</Text>
                <Text style={styles.stopAddress}>{stop.address}</Text>
                {stop.so_number && <Text style={styles.stopSo}>SO: {stop.so_number}</Text>}
              </View>
              <View style={[styles.stopBadge, stop.status === 'delivered' ? styles.badgeDelivered : styles.badgePending]}>
                <Text style={styles.stopBadgeText}>{stop.status}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.noStops}>No stops assigned</Text>}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noRouteIcon: { fontSize: 56, marginBottom: 12 },
  noRouteTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  noRouteText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 20, textAlign: 'center' },
  refreshBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  refreshBtnText: { color: COLORS.white, fontWeight: '700' },
  routeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeDate: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  vehicleText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 4 },
  stopsText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  gpsIndicator: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  gpsText: { color: COLORS.success, fontSize: 12, fontWeight: '600' },
  gpsIndicatorError: { backgroundColor: '#FFEBEE' },
  gpsTextError: { color: COLORS.danger },
  startBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  completedText: { color: COLORS.success, fontWeight: '700', fontSize: 14, marginTop: 8, textAlign: 'center' },
  btnDisabled: { opacity: 0.6 },
  stopsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  stopCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  stopCardDone: { opacity: 0.6, borderLeftColor: COLORS.success },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  stopInfo: { flex: 1 },
  stopRecipient: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  stopAddress: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  stopSo: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  stopBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeDelivered: { backgroundColor: '#E8F5E9' },
  badgePending: { backgroundColor: '#FFF3E0' },
  stopBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.text },
  noStops: { textAlign: 'center', color: COLORS.textMuted, marginTop: 24 },
});
