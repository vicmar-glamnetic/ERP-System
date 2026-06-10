import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { confirmPutawayFreeForm, PendingPutawayItem, getWarehouses, getWarehouseBins } from '../../api/wms';
import { BinLocation } from '../../types';
import { COLORS } from '../../constants';

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface Props {
  visible: boolean;
  item: PendingPutawayItem | null;
  onClose(): void;
  onSuccess(): void;
}

export function AssignBinModal({ visible, item, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'manual' | 'search'>('manual');
  const [manualBinId, setManualBinId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingBins, setLoadingBins] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setActiveTab('manual');
      setManualBinId('');
      setSelectedWarehouseId(null);
      setBins([]);
      setSelectedBinId(null);
      setError(null);
      loadWarehouses();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadBins(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  async function loadWarehouses() {
    setLoadingWarehouses(true);
    try {
      const result = await getWarehouses();
      setWarehouses(result);
    } catch {
      // non-critical
    } finally {
      setLoadingWarehouses(false);
    }
  }

  async function loadBins(warehouseId: string) {
    setLoadingBins(true);
    setBins([]);
    setSelectedBinId(null);
    try {
      const result = await getWarehouseBins(warehouseId);
      setBins(result);
    } catch {
      setBins([]);
    } finally {
      setLoadingBins(false);
    }
  }

  async function handleConfirm() {
    if (!item) return;
    const bin_id = activeTab === 'manual' ? manualBinId.trim() : selectedBinId;
    if (!bin_id) return;

    setSubmitting(true);
    setError(null);
    try {
      await confirmPutawayFreeForm(item.grn_log_id, bin_id);
      Alert.alert('Done', 'Item assigned to bin successfully.', [
        { text: 'OK', onPress: () => { onSuccess(); onClose(); } },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to confirm putaway';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const confirmDisabled =
    submitting ||
    (activeTab === 'manual' ? manualBinId.trim() === '' : selectedBinId === null);

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Item summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.productName}>{item.product_name}</Text>
              <Text style={styles.sku}>{item.product_sku}</Text>
            </View>
            <Text style={styles.qty}>Qty: {item.qty_received} units</Text>
            {item.lot_number ? <Text style={styles.lot}>Lot: {item.lot_number}</Text> : null}
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['manual', 'search'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => { setActiveTab(tab); setError(null); }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'manual' ? 'Manual' : 'Search'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
            {activeTab === 'manual' ? (
              <View>
                <Text style={styles.label}>Bin ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. A-01-01"
                  value={manualBinId}
                  onChangeText={setManualBinId}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.label}>Warehouse</Text>
                {loadingWarehouses ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <View style={styles.chipRow}>
                    {warehouses.map(w => (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.chip, selectedWarehouseId === w.id && styles.chipActive]}
                        onPress={() => setSelectedWarehouseId(w.id)}
                      >
                        <Text style={[styles.chipText, selectedWarehouseId === w.id && styles.chipTextActive]}>
                          {w.code} · {w.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selectedWarehouseId && (
                  <>
                    <Text style={[styles.label, { marginTop: 16 }]}>Select Bin</Text>
                    {loadingBins ? (
                      <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
                    ) : (
                      <FlatList
                        data={bins}
                        keyExtractor={b => b.id}
                        scrollEnabled={false}
                        renderItem={({ item: bin }) => {
                          const selected = selectedBinId === bin.id;
                          return (
                            <TouchableOpacity
                              style={[styles.binRow, selected && styles.binRowActive]}
                              onPress={() => setSelectedBinId(bin.id)}
                            >
                              <Text style={[styles.binCode, selected && styles.binCodeActive]}>
                                {bin.aisle} · {bin.bay} · {bin.level}
                              </Text>
                              <Text style={[styles.binCap, selected && styles.binCapActive]}>
                                {(bin as any).qty_total ?? 0} / {(bin as any).capacity ?? '—'}
                              </Text>
                            </TouchableOpacity>
                          );
                        }}
                        ListEmptyComponent={
                          <Text style={styles.emptyBins}>No bins found for this warehouse.</Text>
                        }
                      />
                    )}
                  </>
                )}
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.confirmBtn, confirmDisabled && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={confirmDisabled}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.confirmBtnText}>Confirm Putaway</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  summary: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  sku: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  qty: { fontSize: 12, color: COLORS.textMuted },
  lot: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  tabContent: { flexGrow: 0 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },
  binRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  binRowActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  binCode: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  binCodeActive: { color: COLORS.white },
  binCap: { fontSize: 12, color: COLORS.textMuted },
  binCapActive: { color: 'rgba(255,255,255,0.8)' },
  emptyBins: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 16 },
  errorText: { fontSize: 12, color: COLORS.danger, marginBottom: 8, textAlign: 'center' },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
});
