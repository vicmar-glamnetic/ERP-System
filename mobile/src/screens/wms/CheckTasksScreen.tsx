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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { getMyCheckTasks, confirmCheckTask, failCheckTask, CheckTask } from '../../api/wms';
import { COLORS } from '../../constants';

type ModalMode = 'confirm' | 'fail';

interface ActionModalProps {
  task: CheckTask;
  mode: ModalMode;
  onClose: () => void;
  onSuccess: () => void;
}

function ActionModal({ task, mode, onClose, onSuccess }: ActionModalProps) {
  const [qtyInput, setQtyInput] = useState(String(task.qty_expected));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (mode === 'confirm') {
      const qty = parseInt(qtyInput, 10);
      if (isNaN(qty) || qty < 0) {
        Alert.alert('Invalid Quantity', 'Enter a valid number.');
        return;
      }
      if (qty === 0) {
        Alert.alert('Zero Quantity', 'If nothing was found, use the Fail option instead.');
        return;
      }
    } else {
      if (!notes.trim()) {
        Alert.alert('Notes Required', 'Please describe why this check failed.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'confirm') {
        await confirmCheckTask(task.id, parseInt(qtyInput, 10));
        Alert.alert('Passed ✓', `${task.product_name} — ${qtyInput} units verified.`, [
          { text: 'OK', onPress: onSuccess },
        ]);
      } else {
        await failCheckTask(task.id, notes.trim());
        Alert.alert('Flagged ✗', `${task.product_name} marked as failed.`, [
          { text: 'OK', onPress: onSuccess },
        ]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isConfirm = mode === 'confirm';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.modalHeader, isConfirm ? styles.headerPass : styles.headerFail]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={submitting}>
          <Text style={styles.closeBtnText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.modalHeaderTitle}>
          {isConfirm ? '✓ Confirm Check' : '✗ Fail Check'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Task info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoSo}>SO: {task.so_number}</Text>
          <Text style={styles.infoCustomer}>{task.customer_name}</Text>
          <View style={styles.infoDivider} />
          <Text style={styles.infoSku}>{task.product_sku}</Text>
          <Text style={styles.infoProduct}>{task.product_name}</Text>
          <View style={styles.qtyExpected}>
            <Text style={styles.qtyExpLabel}>Expected qty</Text>
            <Text style={styles.qtyExpValue}>{task.qty_expected}</Text>
          </View>
        </View>

        {isConfirm ? (
          <>
            <Text style={styles.inputLabel}>Actual Qty Checked</Text>
            <TextInput
              style={[
                styles.input,
                parseInt(qtyInput) !== task.qty_expected && qtyInput !== '' && styles.inputWarning,
              ]}
              value={qtyInput}
              onChangeText={setQtyInput}
              keyboardType="number-pad"
              selectTextOnFocus
              editable={!submitting}
              placeholderTextColor={COLORS.textMuted}
            />
            {qtyInput !== '' && parseInt(qtyInput) !== task.qty_expected && (
              <Text style={styles.discrepancyNote}>
                ⚠ Qty differs from expected ({task.qty_expected}). This will still pass — flag if you want to reject.
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Reason for Failure</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Missing 3 units, damaged packaging…"
              multiline
              numberOfLines={4}
              editable={!submitting}
              placeholderTextColor={COLORS.textMuted}
            />
          </>
        )}

        <TouchableOpacity
          style={[
            styles.actionBtn,
            isConfirm ? styles.btnPass : styles.btnFail,
            submitting && styles.btnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.actionBtnText}>
              {isConfirm ? '✓ Mark Passed' : '✗ Mark Failed'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Group tasks by SO number
function groupBySO(tasks: CheckTask[]): { so_number: string; customer_name: string; tasks: CheckTask[] }[] {
  const map = new Map<string, { so_number: string; customer_name: string; tasks: CheckTask[] }>();
  for (const t of tasks) {
    if (!map.has(t.so_number)) {
      map.set(t.so_number, { so_number: t.so_number, customer_name: t.customer_name, tasks: [] });
    }
    map.get(t.so_number)!.tasks.push(t);
  }
  return Array.from(map.values());
}

export function CheckTasksScreen() {
  const [tasks, setTasks] = useState<CheckTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalState, setModalState] = useState<{ task: CheckTask; mode: ModalMode } | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await getMyCheckTasks();
      setTasks(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSuccess = () => {
    setModalState(null);
    load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  const groups = groupBySO(tasks);

  return (
    <View style={styles.container}>
      <Modal
        visible={!!modalState}
        animationType="slide"
        onRequestClose={() => setModalState(null)}
      >
        {modalState && (
          <ActionModal
            task={modalState.task}
            mode={modalState.mode}
            onClose={() => setModalState(null)}
            onSuccess={handleSuccess}
          />
        )}
      </Modal>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.so_number}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All Done</Text>
            <Text style={styles.emptyText}>No pending check tasks assigned to you.</Text>
          </View>
        }
        ListHeaderComponent={
          tasks.length > 0 ? (
            <Text style={styles.listHeader}>
              {tasks.length} item{tasks.length !== 1 ? 's' : ''} to check
            </Text>
          ) : null
        }
        renderItem={({ item: group }) => (
          <View style={styles.soGroup}>
            {/* SO Header */}
            <View style={styles.soHeader}>
              <Text style={styles.soNumber}>{group.so_number}</Text>
              <Text style={styles.soCustomer}>{group.customer_name}</Text>
            </View>

            {/* Task rows */}
            {group.tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskSku}>{task.product_sku}</Text>
                  <Text style={styles.taskProduct}>{task.product_name}</Text>
                  <Text style={styles.taskQty}>Expected: {task.qty_expected} units</Text>
                </View>
                <View style={styles.taskActions}>
                  <TouchableOpacity
                    style={styles.passBtn}
                    onPress={() => setModalState({ task, mode: 'confirm' })}
                  >
                    <Text style={styles.passBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.failBtn}
                    onPress={() => setModalState({ task, mode: 'fail' })}
                  >
                    <Text style={styles.failBtnText}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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

  soGroup: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 2,
  },
  soHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soNumber: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  soCustomer: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  taskInfo: { flex: 1 },
  taskSku: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  taskProduct: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  taskQty: { fontSize: 12, color: COLORS.textMuted },

  taskActions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  passBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.success,
  },
  passBtnText: { fontSize: 18, color: COLORS.success, fontWeight: '700' },
  failBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEECEC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  failBtnText: { fontSize: 18, color: COLORS.danger, fontWeight: '700' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  // Modal styles
  modalHeader: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPass: { backgroundColor: COLORS.success },
  headerFail: { backgroundColor: COLORS.danger },
  closeBtn: { marginRight: 12 },
  closeBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  modalHeaderTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
  },
  infoSo: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  infoCustomer: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 },
  infoDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  infoSku: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 2 },
  infoProduct: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  qtyExpected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
  },
  qtyExpLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  qtyExpValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    textAlign: 'center',
  },
  inputMulti: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'left',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputWarning: { borderColor: COLORS.warning },
  discrepancyNote: {
    fontSize: 12,
    color: COLORS.warning,
    marginBottom: 16,
    lineHeight: 18,
  },

  actionBtn: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPass: { backgroundColor: COLORS.success },
  btnFail: { backgroundColor: COLORS.danger },
  btnDisabled: { opacity: 0.5 },
  actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
