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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getMyPutawayTasks, confirmPutaway, PutawayTask } from '../../api/wms';
import { COLORS } from '../../constants';

interface ScanModalProps {
  task: PutawayTask;
  onClose: () => void;
  onSuccess: () => void;
}

function ScanModal({ task, onClose, onSuccess }: ScanModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);

  const handleBarcode = useCallback(
    async ({ data: scannedId }: { data: string }) => {
      if (scanned || confirming) return;
      setScanned(true);
      setScannedLabel(scannedId);

      if (scannedId !== task.to_bin_id) {
        Alert.alert(
          'Wrong Bin',
          `Scanned: …${scannedId.slice(-8)}\nExpected: …${task.to_bin_id.slice(-8)}\n\nScan the correct destination bin.`,
          [{ text: 'Try Again', onPress: () => { setScanned(false); setScannedLabel(null); } }]
        );
        return;
      }

      setConfirming(true);
      try {
        await confirmPutaway(task.id, scannedId);
        Alert.alert('Putaway Complete', `${task.product_name} moved to ${task.to_aisle}-${task.to_bay}-${task.to_level}.`, [
          { text: 'OK', onPress: onSuccess },
        ]);
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed';
        Alert.alert('Error', msg);
        setScanned(false);
        setScannedLabel(null);
      } finally {
        setConfirming(false);
      }
    },
    [scanned, confirming, task, onSuccess]
  );

  if (!permission) {
    return (
      <View style={styles.modalCenter}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.modalCenter}>
        <Text style={styles.permText}>Camera access is required to scan bin barcodes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.scanHeader}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.scanTitle}>Scan Destination Bin</Text>
      </View>

      {/* Task context */}
      <View style={styles.taskBanner}>
        <Text style={styles.taskBannerSku}>{task.product_sku}</Text>
        <Text style={styles.taskBannerName}>{task.product_name}</Text>
        <Text style={styles.taskBannerRoute}>
          From{' '}
          <Text style={styles.bold}>{task.from_aisle}-{task.from_bay}-{task.from_level}</Text>
          {'  →  '}
          <Text style={[styles.bold, { color: COLORS.success }]}>
            {task.to_aisle}-{task.to_bay}-{task.to_level}
          </Text>
          {'  ·  '}{task.qty} units
        </Text>
      </View>

      {/* Camera */}
      {confirming ? (
        <View style={styles.confirmingOverlay}>
          <ActivityIndicator color={COLORS.white} size="large" />
          <Text style={styles.confirmingText}>Confirming putaway…</Text>
        </View>
      ) : (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        />
      )}

      {/* Aim guide */}
      {!confirming && (
        <View style={styles.aimGuide} pointerEvents="none">
          <View style={styles.aimBox} />
          <Text style={styles.aimText}>Point at the destination bin barcode</Text>
        </View>
      )}
    </View>
  );
}

export function PutawayScreen() {
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTask, setActiveTask] = useState<PutawayTask | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await getMyPutawayTasks();
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
    setActiveTask(null);
    load();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Scanner modal */}
      <Modal visible={!!activeTask} animationType="slide" onRequestClose={() => setActiveTask(null)}>
        {activeTask && (
          <ScanModal
            task={activeTask}
            onClose={() => setActiveTask(null)}
            onSuccess={handleSuccess}
          />
        )}
      </Modal>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Putaway Tasks</Text>
            <Text style={styles.emptyText}>All items have been put away.</Text>
          </View>
        }
        ListHeaderComponent={
          tasks.length > 0 ? (
            <Text style={styles.listHeader}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} pending
            </Text>
          ) : null
        }
        renderItem={({ item: task }) => (
          <View style={styles.taskCard}>
            <View style={styles.taskTop}>
              <View style={styles.skuBadge}>
                <Text style={styles.skuText}>{task.product_sku}</Text>
              </View>
              <Text style={styles.qtyText}>{task.qty} units</Text>
            </View>
            <Text style={styles.productName}>{task.product_name}</Text>

            <View style={styles.routeRow}>
              <View style={styles.binBox}>
                <Text style={styles.binLabel}>FROM</Text>
                <Text style={styles.binCode}>
                  {task.from_aisle}-{task.from_bay}-{task.from_level}
                </Text>
                <Text style={styles.binType}>Staging</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
              <View style={[styles.binBox, styles.binBoxDest]}>
                <Text style={styles.binLabel}>TO</Text>
                <Text style={[styles.binCode, { color: COLORS.success }]}>
                  {task.to_aisle}-{task.to_bay}-{task.to_level}
                </Text>
                <Text style={styles.binType}>Rack</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => setActiveTask(task)}
            >
              <Text style={styles.scanBtnText}>📷 Scan Bin to Confirm</Text>
            </TouchableOpacity>
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
  taskCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  skuBadge: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  skuText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  qtyText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  productName: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12 },

  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  binBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  binBoxDest: { borderColor: COLORS.success + '66', backgroundColor: '#F0FFF4' },
  binLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  binCode: { fontSize: 16, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  binType: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  arrow: { fontSize: 20, color: COLORS.textMuted, fontWeight: '300' },

  scanBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },

  // Scan modal styles
  scanHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: { marginRight: 12 },
  closeBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  scanTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  taskBanner: {
    backgroundColor: '#1A1A2E',
    padding: 14,
  },
  taskBannerSku: { fontSize: 11, fontWeight: '700', color: '#8888CC', letterSpacing: 0.8 },
  taskBannerName: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginTop: 2, marginBottom: 4 },
  taskBannerRoute: { fontSize: 13, color: '#AAAACC' },
  bold: { fontWeight: '700' },

  confirmingOverlay: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  confirmingText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },

  aimGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aimBox: {
    width: 240,
    height: 120,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    marginBottom: 16,
  },
  aimText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText: { fontSize: 14, color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permBtnText: { color: COLORS.white, fontWeight: '700' },
});
