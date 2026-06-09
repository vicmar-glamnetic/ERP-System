import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getPOs, receiveStock, getWarehouses, getWarehouseBins } from '../../api/wms';
import { PurchaseOrder, POLine, BinLocation } from '../../types';
import { COLORS } from '../../constants';

export function ReceiveScreen() {
  const [poInput, setPoInput] = useState('');
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loadingPO, setLoadingPO] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  // Receive modal state
  const [activeLine, setActiveLine] = useState<POLine | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [lotInput, setLotInput] = useState('');
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [selectedBin, setSelectedBin] = useState<BinLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchPO = async (poNumber?: string) => {
    const term = (poNumber ?? poInput).trim();
    if (!term) return;
    setLoadingPO(true);
    setPo(null);
    try {
      const list = await getPOs();
      const found = list.find(
        (p) => p.po_number.toLowerCase() === term.toLowerCase()
      );
      if (!found) {
        Alert.alert('Not Found', `PO "${term}" not found.`);
      } else {
        setPo(found);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to load POs');
    } finally {
      setLoadingPO(false);
    }
  };

  const handleScanPO = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Camera permission required'); return; }
    }
    scanned.current = false;
    setScanning(true);
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    setScanning(false);
    setPoInput(data);
    searchPO(data);
  };

  const openReceive = async (line: POLine) => {
    setActiveLine(line);
    setQtyInput(String(line.qty_ordered - line.qty_received));
    setLotInput('');
    setSelectedBin(null);
    try {
      const whs = await getWarehouses();
      if (whs.length > 0) {
        const b = await getWarehouseBins(whs[0].id);
        setBins(b);
        if (b.length > 0) setSelectedBin(b[0]);
      }
    } catch (e) {
      console.error('Failed to load bins', e);
    }
  };

  const submitReceive = async () => {
    if (!activeLine || !selectedBin) return;
    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Enter a valid quantity');
      return;
    }
    setSubmitting(true);
    try {
      await receiveStock(activeLine.id, selectedBin.id, qty, lotInput || undefined);
      Alert.alert('Success', `Received ${qty} × ${activeLine.name}`);
      setActiveLine(null);
      searchPO();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Failed to receive');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingLines = po?.lines?.filter((l) => l.qty_received < l.qty_ordered) ?? [];

  if (scanning) {
    return (
      <Modal visible animationType="slide">
        <View style={styles.scanContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={onBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
          />
          <TouchableOpacity style={styles.cancelScan} onPress={() => setScanning(false)}>
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      {/* PO Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Type PO number (e.g. PO-2026-001)"
          placeholderTextColor={COLORS.textMuted}
          value={poInput}
          onChangeText={setPoInput}
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={() => searchPO()}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => searchPO()}>
          {loadingPO ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.scanPOBtn} onPress={handleScanPO}>
        <Text style={styles.scanPOText}>📷 Scan PO Barcode</Text>
      </TouchableOpacity>

      {/* PO Details */}
      {po && (
        <View style={styles.poCard}>
          <Text style={styles.poNumber}>{po.po_number}</Text>
          <Text style={styles.poSupplier}>{po.supplier_name}</Text>
          <View style={[styles.badge, po.status === 'received' ? styles.badgeGreen : styles.badgeAmber]}>
            <Text style={styles.badgeText}>{po.status}</Text>
          </View>
        </View>
      )}

      {/* Lines */}
      {po && (
        <FlatList
          data={pendingLines}
          keyExtractor={(item) => item.id}
          style={styles.lineList}
          ListEmptyComponent={
            <Text style={styles.doneText}>✅ All lines fully received</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.lineCard}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{item.name}</Text>
                <Text style={styles.lineSku}>{item.sku}</Text>
                <Text style={styles.lineQty}>
                  {item.qty_received} / {item.qty_ordered} received
                </Text>
              </View>
              <TouchableOpacity
                style={styles.receiveBtn}
                onPress={() => openReceive(item)}
              >
                <Text style={styles.receiveBtnText}>Receive</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Receive Modal */}
      <Modal visible={!!activeLine} animationType="slide" transparent>
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ padding: 24 }}>
            <Text style={styles.modalTitle}>Receive Stock</Text>
            {activeLine && (
              <>
                <Text style={styles.modalProduct}>{activeLine.name}</Text>
                <Text style={styles.modalSku}>{activeLine.sku}</Text>

                <Text style={styles.label}>Qty to Receive</Text>
                <TextInput
                  style={styles.input}
                  value={qtyInput}
                  onChangeText={setQtyInput}
                  keyboardType="numeric"
                  selectTextOnFocus
                />

                <Text style={styles.label}>Destination Bin</Text>
                <FlatList
                  data={bins}
                  keyExtractor={(b) => b.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.binOption, selectedBin?.id === item.id && styles.binSelected]}
                      onPress={() => setSelectedBin(item)}
                    >
                      <Text style={[styles.binLabel, selectedBin?.id === item.id && styles.binLabelSelected]}>
                        {item.aisle}-{item.bay}-{item.level}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.noBins}>No bins available</Text>}
                />

                <Text style={styles.label}>Lot Number (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={lotInput}
                  onChangeText={setLotInput}
                  placeholder="e.g. LOT-2026-001"
                  placeholderTextColor={COLORS.textMuted}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setActiveLine(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.btnDisabled]}
                    onPress={submitReceive}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>Confirm Receive</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBox: {
    flexDirection: 'row',
    margin: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: COLORS.white, fontWeight: '700' },
  scanPOBtn: {
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanPOText: { color: COLORS.primary, fontWeight: '600' },
  poCard: {
    margin: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  poNumber: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  poSupplier: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeAmber: { backgroundColor: '#FFF3E0' },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  lineList: { flex: 1, paddingHorizontal: 12 },
  lineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lineSku: { fontSize: 12, color: COLORS.textMuted },
  lineQty: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  receiveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  receiveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  doneText: {
    textAlign: 'center',
    color: COLORS.success,
    fontWeight: '600',
    marginTop: 24,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalProduct: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 8 },
  modalSku: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  binOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  binSelected: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  binLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  binLabelSelected: { color: COLORS.primary, fontWeight: '700' },
  noBins: { color: COLORS.textMuted, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: COLORS.white, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  scanContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cancelScan: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
