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
import { Ionicons } from '@expo/vector-icons';
import { getPendingPutaway, PendingPutawayItem } from '../../api/wms';
import { AssignBinModal } from './AssignBinModal';
import { COLORS } from '../../constants';

export function PutawayScreen() {
  const [items, setItems] = useState<PendingPutawayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingPutawayItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getPendingPutaway();
      setItems(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAssign = (item: PendingPutawayItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleSuccess = () => {
    setModalVisible(false);
    setSelectedItem(null);
    load();
  };

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
        data={items}
        keyExtractor={item => item.grn_log_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No items pending putaway</Text>
          </View>
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.listHeader}>
              {items.length} item{items.length !== 1 ? 's' : ''} pending putaway
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.sku}>{item.product_sku}</Text>
              <TouchableOpacity style={styles.assignBtn} onPress={() => handleAssign(item)}>
                <Text style={styles.assignBtnText}>Assign Bin →</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.productName}>{item.product_name}</Text>
            <Text style={styles.meta}>Qty: {item.qty_received} units</Text>
            {item.lot_number ? (
              <Text style={styles.meta}>Lot: {item.lot_number}</Text>
            ) : null}
          </View>
        )}
      />

      <AssignBinModal
        visible={modalVisible}
        item={selectedItem}
        onClose={() => { setModalVisible(false); setSelectedItem(null); }}
        onSuccess={handleSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sku: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  productName: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  assignBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  assignBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
