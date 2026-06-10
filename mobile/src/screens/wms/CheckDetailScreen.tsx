import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { completeCheckTask } from '../../api/wms';
import { CheckTask, CheckTaskLine } from '../../types';
import { COLORS } from '../../constants';
import type { WMSStackParamList } from './CheckTasksScreen';

type Route = NativeStackScreenProps<WMSStackParamList, 'CheckDetail'>['route'];
type Nav = NativeStackNavigationProp<WMSStackParamList>;

export function CheckDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { task } = route.params;

  const [checkedLineIds, setCheckedLineIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checkedLineIds.size === task.lines.length;

  function toggleLine(id: string) {
    setCheckedLineIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doComplete(passed: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      await completeCheckTask(task.id, passed, notes.trim() || undefined);
      Alert.alert(
        passed ? 'QC Passed' : 'Returned to Picking',
        passed ? 'SO is ready for dispatch.' : 'SO has been returned to picking.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleComplete() {
    doComplete(true);
  }

  function handleFail() {
    Alert.alert(
      'Confirm Failure',
      'This will send the SO back to picking. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Fail', style: 'destructive', onPress: () => doComplete(false) },
      ]
    );
  }

  const progress = task.lines.length > 0 ? checkedLineIds.size / task.lines.length : 0;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* SO info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Customer</Text>
          <Text style={styles.infoValue}>{task.customer_name}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Required</Text>
              <Text style={styles.infoValue}>
                {task.required_date ? formatDate(task.required_date) : '—'}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Items</Text>
              <Text style={styles.infoValue}>{task.lines.length}</Text>
            </View>
          </View>
        </View>

        {/* Lines checklist */}
        <Text style={styles.sectionTitle}>Items to verify</Text>
        <View style={styles.linesCard}>
          {task.lines.map((line: CheckTaskLine, idx: number) => {
            const checked = checkedLineIds.has(line.id);
            const mismatch = line.qty_picked < line.qty_ordered;
            return (
              <TouchableOpacity
                key={line.id}
                style={[
                  styles.lineRow,
                  idx < task.lines.length - 1 && styles.lineRowBorder,
                ]}
                onPress={() => toggleLine(line.id)}
                activeOpacity={0.7}
              >
                {/* Checkbox */}
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>

                {/* Product info */}
                <View style={styles.lineInfo}>
                  <Text style={styles.lineName}>{line.product_name}</Text>
                  <Text style={styles.lineSku}>{line.product_sku}</Text>
                </View>

                {/* Quantities */}
                <View style={styles.lineQty}>
                  <Text style={styles.lineQtyLabel}>Ordered: {line.qty_ordered}</Text>
                  <Text style={[styles.lineQtyLabel, mismatch && styles.qtyMismatch]}>
                    Picked: {line.qty_picked}
                    {mismatch ? ' ⚠' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {checkedLineIds.size} / {task.lines.length} verified
        </Text>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add quality check notes..."
          placeholderTextColor={COLORS.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Fixed bottom buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.passBtn, (!allChecked || submitting) && styles.btnDisabled]}
          onPress={handleComplete}
          disabled={!allChecked || submitting}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.passBtnText}>✓  Pass & Ready to Dispatch</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.failBtn, (!allChecked || submitting) && styles.btnDisabled]}
          onPress={handleFail}
          disabled={!allChecked || submitting}
        >
          <Text style={styles.failBtnText}>✗  Fail — Return to Picking</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 32 },

  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: { flexDirection: 'row', marginTop: 10, gap: 16 },
  infoCell: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  linesCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  lineRowBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkmark: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  lineSku: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  lineQty: { alignItems: 'flex-end' },
  lineQtyLabel: { fontSize: 11, color: COLORS.textMuted },
  qtyMismatch: { color: COLORS.danger, fontWeight: '700' },

  progressBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginBottom: 20,
  },

  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  errorText: { fontSize: 12, color: COLORS.danger, textAlign: 'center', marginBottom: 8 },

  bottomBar: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  passBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  passBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  failBtn: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  failBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
});
