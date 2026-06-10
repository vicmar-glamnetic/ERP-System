import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCompletedRoutes, submitFuelLog, getMyFuelLogs } from '../../api/tms';
import { CompletedRoute, FuelLogEntry } from '../../types';
import { COLORS } from '../../constants';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FuelLogScreen() {
  const [routes, setRoutes] = useState<CompletedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<CompletedRoute | null>(null);
  const [liters, setLiters] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<FuelLogEntry[]>([]);

  const litersNum = parseFloat(liters);
  const distNum = parseFloat(distanceKm);
  const efficiency =
    liters && distanceKm && litersNum > 0 && distNum > 0
      ? (distNum / litersNum).toFixed(1)
      : null;

  const loadData = useCallback(async () => {
    try {
      const [r, logs] = await Promise.all([getCompletedRoutes(), getMyFuelLogs()]);
      setRoutes(r);
      setRecentLogs(logs.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  async function handleSubmit() {
    if (!selectedRoute) return;
    if (!liters || litersNum <= 0) { setError('Enter a valid liters amount'); return; }
    if (!distanceKm || distNum <= 0) { setError('Enter a valid distance'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFuelLog(selectedRoute.id, litersNum, distNum);
      const eff = result.efficiency_km_per_l ?? efficiency ?? '—';
      Alert.alert('Fuel Log Submitted', `Efficiency: ${eff} km/L. Good work!`);
      setLiters('');
      setDistanceKm('');
      setSelectedRoute(null);
      // Refresh logs
      const logs = await getMyFuelLogs();
      setRecentLogs(logs.slice(0, 5));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to submit';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    !selectedRoute || !liters || !distanceKm ||
    litersNum <= 0 || distNum <= 0 || submitting;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.secondary} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        {/* ── Section 1: Log Fuel ── */}
        <Text style={styles.sectionTitle}>Log Fuel</Text>

        {/* Route selector */}
        <Text style={styles.label}>Select completed route</Text>
        {routes.length === 0 ? (
          <View style={styles.emptyRoutes}>
            <Text style={styles.emptyText}>No completed routes found</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.refreshLink}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={routes}
            horizontal
            keyExtractor={r => r.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item: route }) => {
              const selected = selectedRoute?.id === route.id;
              return (
                <TouchableOpacity
                  style={[styles.routeCard, selected && styles.routeCardSelected]}
                  onPress={() => setSelectedRoute(route)}
                >
                  <Text style={[styles.routeDate, selected && styles.routeDateSelected]}>
                    {formatDate(route.route_date)}
                  </Text>
                  <Text style={[styles.routeMeta, selected && styles.routeMetaSelected]}>
                    {route.plate_number} · {route.vehicle_type}
                  </Text>
                  <Text style={[styles.routeStops, selected && styles.routeMetaSelected]}>
                    {route.stop_count} stop{route.stop_count !== 1 ? 's' : ''} completed
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Form — only shown when a route is selected */}
        {selectedRoute && (
          <View style={styles.formCard}>
            {/* Auto-filled vehicle info */}
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleText}>
                {selectedRoute.plate_number} · {selectedRoute.vehicle_type}
              </Text>
            </View>

            {/* Liters input */}
            <Text style={styles.inputLabel}>Liters used</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 18.5"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={liters}
              onChangeText={v => { setLiters(v); setError(null); }}
            />

            {/* Distance input */}
            <Text style={styles.inputLabel}>Distance driven (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 85.0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={distanceKm}
              onChangeText={v => { setDistanceKm(v); setError(null); }}
            />

            {/* Live efficiency */}
            {efficiency !== null ? (
              <View style={styles.efficiencyRow}>
                <Ionicons name="flame-outline" size={16} color={COLORS.warning} />
                <Text style={styles.efficiencyText}>Efficiency: {efficiency} km/L</Text>
              </View>
            ) : (
              <Text style={styles.efficiencyPlaceholder}>
                Enter liters and distance to see efficiency
              </Text>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, submitDisabled && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitDisabled}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitBtnText}>Submit Fuel Log</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Section 2: Recent Logs ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Logs</Text>
        <Text style={styles.sectionSub}>(last 5 submissions)</Text>

        {recentLogs.length === 0 ? (
          <Text style={styles.emptyText}>No fuel logs yet</Text>
        ) : (
          <View style={styles.logsCard}>
            {recentLogs.map((log, idx) => (
              <View
                key={log.id}
                style={[styles.logRow, idx < recentLogs.length - 1 && styles.logRowBorder]}
              >
                <View>
                  <Text style={styles.logDate}>
                    {log.route_date ? formatDate(log.route_date) : formatDate(log.logged_at)}
                  </Text>
                  <Text style={styles.logMeta}>{log.liters} L · {log.distance_km} km</Text>
                </View>
                <Text style={styles.logEfficiency}>
                  {log.efficiency_km_per_l != null ? `${log.efficiency_km_per_l} km/L` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionSub: { fontSize: 11, color: COLORS.textMuted, marginBottom: 10 },
  label: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },

  emptyRoutes: { alignItems: 'center', paddingVertical: 12 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4 },
  refreshLink: { fontSize: 13, color: COLORS.secondary, fontWeight: '600' },

  // Route selector cards
  routeCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    backgroundColor: COLORS.white,
    minWidth: 140,
  },
  routeCardSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: '#FFF8F0',
  },
  routeDate: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  routeDateSelected: { color: COLORS.secondary },
  routeMeta: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  routeMetaSelected: { color: COLORS.secondary },
  routeStops: { fontSize: 11, color: COLORS.textMuted },

  // Form
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleRow: {
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  vehicleText: { fontSize: 12, color: COLORS.textMuted },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 14,
    backgroundColor: COLORS.background,
  },
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  efficiencyText: { fontSize: 14, fontWeight: '700', color: COLORS.warning },
  efficiencyPlaceholder: { fontSize: 12, color: COLORS.textMuted, marginBottom: 14, textAlign: 'center' },
  errorText: { fontSize: 12, color: COLORS.danger, marginBottom: 8, textAlign: 'center' },
  submitBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Recent logs
  logsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logRowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  logDate: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  logMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  logEfficiency: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
});
