import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import {
  getPendingPutaway, PendingPutawayItem,
  getAssignedPutawayTasks, AssignedPutawayTask,
} from '../../api/wms';
import { AssignBinModal } from './AssignBinModal';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../constants';

type Tab = 'assigned' | 'all';

// Bin picker confirm for assigned tasks (uses new endpoint)
function ConfirmBinModal({
  task,
  visible,
  onClose,
  onSuccess,
}: {
  task: AssignedPutawayTask | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Reuse AssignBinModal but convert AssignedPutawayTask → PendingPutawayItem shape
  if (!task) return null;
  const asItem: PendingPutawayItem = {
    grn_log_id: task.id, // AssignBinModal uses this as the task ID for confirm-free; we override below
    product_sku: task.product_sku,
    product_name: task.product_name,
    qty_received: task.qty,
    lot_number: task.lot_number,
  };

  return (
    <AssignBinModal
      visible={visible}
      item={asItem}
      onClose={onClose}
      onSuccess={onSuccess}
      taskId={task.id}
      useNewEndpoint
    />
  );
}

export function PutawayScreen() {
  const { state } = useAuth();
  const role = state.user?.role ?? '';
  const isSupervisor = ['wh_supervisor', 'system_admin', 'operations_manager'].includes(role);

  const [tab, setTab] = useState<Tab>('assigned');
  const [assignedTasks, setAssignedTasks] = useState<AssignedPutawayTask[]>([]);
  const [allPending, setAllPending] = useState<PendingPutawayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AssignedPutawayTask | null>(null);
  const [selectedItem, setSelectedItem] = useState<PendingPutawayItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'assigned' | 'all'>('assigned');

  const load = useCallback(async () => {
    try {
      const [assigned, pending] = await Promise.all([
        getAssignedPutawayTasks(),
        isSupervisor ? getPendingPutaway() : Promise.resolve([]),
      ]);
      setAssignedTasks(assigned);
      setAllPending(pending);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load putaway tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSupervisor]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSuccess = () => {
    setModalVisible(false);
    setSelectedTask(null);
    setSelectedItem(null);
    load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'assigned' && styles.tabActive]}
          onPress={() => setTab('assigned')}
        >
          <Text style={[styles.tabText, tab === 'assigned' && styles.tabTextActive]}>
            Assigned to Me
            {assignedTasks.length > 0 && (
              <Text style={styles.badge}> {assignedTasks.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
        {isSupervisor && (
          <TouchableOpacity
            style={[styles.tab, tab === 'all' && styles.tabActive]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
              All Pending
              {allPending.length > 0 && (
                <Text style={styles.badge}> {allPending.length}</Text>
              )}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Assigned to Me tab */}
      {tab === 'assigned' && (
        <FlatList
          data={assignedTasks}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No tasks assigned to you</Text>
            </View>
          }
          ListHeaderComponent={
            assignedTasks.length > 0 ? (
              <Text style={styles.listHeader}>
                {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''} assigned to you
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.sku}>{item.product_sku}</Text>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => {
                    setSelectedTask(item);
                    setModalType('assigned');
                    setModalVisible(true);
                  }}
                >
                  <Text style={styles.assignBtnText}>Confirm Bin →</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.productName}>{item.product_name}</Text>
              <Text style={styles.meta}>Qty: {item.qty} units</Text>
              {item.warehouse_name ? <Text style={styles.meta}>Warehouse: {item.warehouse_name}</Text> : null}
              {item.from_aisle ? (
                <Text style={styles.meta}>From: {item.from_aisle}-{item.from_bay}-{item.from_level}</Text>
              ) : null}
              {item.lot_number ? <Text style={styles.meta}>Lot: {item.lot_number}</Text> : null}
            </View>
          )}
        />
      )}

      {/* All Pending tab — supervisor only */}
      {tab === 'all' && isSupervisor && (
        <FlatList
          data={allPending}
          keyExtractor={item => item.grn_log_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No pending items</Text>
            </View>
          }
          ListHeaderComponent={
            allPending.length > 0 ? (
              <Text style={styles.listHeader}>
                {allPending.length} item{allPending.length !== 1 ? 's' : ''} pending across warehouse
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.sku}>{item.product_sku}</Text>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => {
                    setSelectedItem(item);
                    setModalType('all');
                    setModalVisible(true);
                  }}
                >
                  <Text style={styles.assignBtnText}>Assign Bin →</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.productName}>{item.product_name}</Text>
              <Text style={styles.meta}>Qty: {item.qty_received} units</Text>
              {item.lot_number ? <Text style={styles.meta}>Lot: {item.lot_number}</Text> : null}
            </View>
          )}
        />
      )}

      {/* Modal for assigned tasks — uses new confirm endpoint */}
      {modalType === 'assigned' && selectedTask && (
        <AssignBinModal
          visible={modalVisible}
          item={{
            grn_log_id: selectedTask.id,
            product_sku: selectedTask.product_sku,
            product_name: selectedTask.product_name,
            qty_received: selectedTask.qty,
            lot_number: selectedTask.lot_number,
          }}
          taskId={selectedTask.id}
          useNewEndpoint
          onClose={() => { setModalVisible(false); setSelectedTask(null); }}
          onSuccess={handleSuccess}
        />
      )}

      {/* Modal for all-pending items — uses legacy free-form endpoint */}
      {modalType === 'all' && selectedItem && (
        <AssignBinModal
          visible={modalVisible}
          item={selectedItem}
          onClose={() => { setModalVisible(false); setSelectedItem(null); }}
          onSuccess={handleSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  badge: { color: COLORS.primary, fontWeight: '700' },

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
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
