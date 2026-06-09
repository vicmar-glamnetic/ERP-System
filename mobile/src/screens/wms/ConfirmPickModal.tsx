import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { PickTask } from '../../types';
import { confirmPick } from '../../api/wms';
import { COLORS } from '../../constants';

interface Props {
  task: PickTask;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmPickModal({ task, onClose, onSuccess }: Props) {
  const [qty, setQty] = useState(String(task.qty_to_pick));
  const [scanning, setScanning] = useState(false);
  const [scannedBin, setScannedBin] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const binLabel = `${task.aisle}-${task.bay}-${task.level}`;

  const handleScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission required for scanning');
        return;
      }
    }
    scanned.current = false;
    setScanning(true);
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    setScannedBin(data);
    setScanning(false);
    Alert.alert('Scanned', `Bin: ${data}`);
  };

  const handleConfirm = async () => {
    const qtyNum = parseInt(qty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Error', 'Enter a valid quantity');
      return;
    }
    setLoading(true);
    try {
      await confirmPick(task.id, qtyNum, task.bin_id);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to confirm pick';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.cancelScanText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm Pick</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Product</Text>
            <Text style={styles.detailValue}>{task.product_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SKU</Text>
            <Text style={styles.detailValue}>{task.product_sku}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bin</Text>
            <Text style={styles.detailValue}>{binLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Required</Text>
            <Text style={styles.detailValue}>{task.qty_to_pick}</Text>
          </View>

          {scannedBin ? (
            <Text style={styles.scannedNote}>✓ Bin scanned: {scannedBin}</Text>
          ) : null}

          <Text style={styles.inputLabel}>Qty Picked</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            selectTextOnFocus
          />

          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <Text style={styles.scanButtonText}>📷 Scan Bin Barcode</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { color: COLORS.textMuted, fontSize: 13 },
  detailValue: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  scannedNote: { color: COLORS.success, fontSize: 12, marginTop: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  scanButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  scanButtonText: { color: COLORS.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: COLORS.white, fontWeight: '700' },
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
