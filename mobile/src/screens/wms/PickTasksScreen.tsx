import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { getMyPickTasks } from '../../api/wms';
import { ConfirmPickModal } from './ConfirmPickModal';
import { PickTask } from '../../types';
import { COLORS } from '../../constants';

export function PickTasksScreen() {
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<PickTask | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await getMyPickTasks();
      setTasks(all.filter((t) => t.status !== 'completed'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No pending pick tasks.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.productName}>{item.product_name}</Text>
              <View style={[styles.badge, item.status === 'pending' ? styles.badgeAmber : styles.badgeGreen]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.sku}>{item.product_sku}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationText}>
                🗂 Aisle {item.aisle} · Bay {item.bay} · Level {item.level}
              </Text>
            </View>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>To Pick:</Text>
              <Text style={styles.qtyValue}>{item.qty_to_pick}</Text>
              <Text style={[styles.qtyLabel, { marginLeft: 16 }]}>Picked:</Text>
              <Text style={styles.qtyValue}>{item.qty_picked}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {selected && (
        <ConfirmPickModal
          task={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); load(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  sku: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeAmber: { backgroundColor: '#FFF3E0' },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  locationRow: { marginBottom: 8 },
  locationText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyLabel: { fontSize: 12, color: COLORS.textMuted },
  qtyValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginLeft: 4 },
});
