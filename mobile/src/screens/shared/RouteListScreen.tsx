import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { getAllRoutes } from '../../api/tms';
import { Route } from '../../types';
import { COLORS } from '../../constants';

const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  in_progress: COLORS.primary,
  completed: COLORS.success,
};

export function RouteListScreen() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const data = await getAllRoutes(filter);
      setRoutes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filters = [undefined, 'pending', 'in_progress', 'completed'];
  const filterLabels: Record<string, string> = {
    undefined: 'All',
    pending: 'Pending',
    in_progress: 'Active',
    completed: 'Done',
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={String(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {filterLabels[String(f)]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={routes}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={routes.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No routes found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.driver}>{item.driver_name ?? '—'}</Text>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? COLORS.textMuted) + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] ?? COLORS.textMuted }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.vehicle}>
              🚛 {item.plate_number} · {item.vehicle_type}
            </Text>
            <Text style={styles.meta}>
              📅 {item.route_date} · {item.stops?.length ?? 0} stops
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  driver: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  vehicle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 2 },
  meta: { fontSize: 12, color: COLORS.textMuted },
});
