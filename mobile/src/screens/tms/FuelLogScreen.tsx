import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getMyRouteToday, submitFuelLog } from '../../api/tms';
import { Route } from '../../types';
import { COLORS } from '../../constants';

export function FuelLogScreen() {
  const [route, setRoute] = useState<Route | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [liters, setLiters] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadRoute = useCallback(async () => {
    try {
      const r = await getMyRouteToday();
      setRoute(r);
    } catch {
      // no route is fine
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  const handleSubmit = async () => {
    if (!route) {
      Alert.alert('No Active Route', 'You need an active route to log fuel.');
      return;
    }
    const litersNum = parseFloat(liters);
    const distNum = parseFloat(distanceKm);
    if (!liters || isNaN(litersNum) || litersNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of liters.');
      return;
    }
    if (!distanceKm || isNaN(distNum) || distNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid distance in km.');
      return;
    }

    setSubmitting(true);
    try {
      await submitFuelLog(route.id, route.vehicle_id, litersNum, distNum);
      setSubmitted(true);
      setLiters('');
      setDistanceKm('');
      Alert.alert('Fuel Log Saved', `Logged ${litersNum}L for ${distNum} km.`);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to submit';
      if (msg === 'QUEUED_OFFLINE') {
        Alert.alert('Saved Offline', 'No connection. Your fuel log will be synced when you reconnect.');
        setSubmitted(true);
        setLiters('');
        setDistanceKm('');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRoute) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.secondary} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        {/* Route context */}
        <View style={styles.routeCard}>
          {route ? (
            <>
              <Text style={styles.routeLabel}>Active Route</Text>
              <Text style={styles.routeDate}>{route.route_date}</Text>
              <Text style={styles.routeMeta}>🚛 {route.plate_number} · {route.vehicle_type}</Text>
              <View style={[styles.statusBadge,
                route.status === 'in_progress' ? styles.badgeActive : styles.badgePending]}>
                <Text style={styles.statusText}>{route.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noRoute}>No route assigned for today.</Text>
          )}
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Fuel Log Entry</Text>

          <Text style={styles.label}>Liters Filled</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 35.5"
            keyboardType="decimal-pad"
            value={liters}
            onChangeText={setLiters}
            placeholderTextColor={COLORS.textMuted}
            editable={!submitting}
          />

          <Text style={styles.label}>Distance Driven (km)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 120"
            keyboardType="decimal-pad"
            value={distanceKm}
            onChangeText={setDistanceKm}
            placeholderTextColor={COLORS.textMuted}
            editable={!submitting}
          />

          {liters && distanceKm && !isNaN(parseFloat(liters)) && !isNaN(parseFloat(distanceKm)) &&
            parseFloat(distanceKm) > 0 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Fuel efficiency</Text>
              <Text style={styles.previewValue}>
                {(parseFloat(distanceKm) / parseFloat(liters)).toFixed(2)} km/L
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!route || submitting) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!route || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitText}>Submit Fuel Log</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Offline notice */}
        <View style={styles.offlineNote}>
          <Text style={styles.offlineText}>
            If you have no signal, your entry will be queued and sent automatically when you reconnect.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  routeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  routeLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  routeDate: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  routeMeta: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: '#E8F5E9' },
  badgePending: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  noRoute: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
    backgroundColor: COLORS.background,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  previewLabel: { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  previewValue: { fontSize: 13, color: COLORS.success, fontWeight: '700' },
  submitBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  offlineNote: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  offlineText: { fontSize: 12, color: COLORS.warning, lineHeight: 18 },
});
