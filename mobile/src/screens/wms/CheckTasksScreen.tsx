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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getCheckTasks } from '../../api/wms';
import { CheckTask } from '../../types';
import { COLORS } from '../../constants';

export type WMSStackParamList = {
  WMSTabs: undefined;
  CheckDetail: { task: CheckTask };
};

type Nav = NativeStackNavigationProp<WMSStackParamList>;

export function CheckTasksScreen() {
  const navigation = useNavigation<Nav>();
  const [tasks, setTasks] = useState<CheckTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const load = useCallback(async () => {
    try {
      const result = await getCheckTasks();
      setTasks(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status !== 'pending');
  const displayed = activeTab === 'pending' ? pendingTasks : completedTasks;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {(['pending', 'completed'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'pending' ? 'Pending' : 'Completed'}
              </Text>
              {tab === 'pending' && pendingTasks.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingTasks.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? 'No pending check tasks' : 'No completed check tasks'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.soNumber}>{item.so_number}</Text>
            <Text style={styles.customer}>{item.customer_name}</Text>
            <Text style={styles.meta}>
              {item.lines.length} item{item.lines.length !== 1 ? 's' : ''}
              {item.required_date ? `  ·  Due ${formatDate(item.required_date)}` : ''}
            </Text>

            {activeTab === 'pending' ? (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => navigation.navigate('CheckDetail', { task: item })}
              >
                <Text style={styles.startBtnText}>Start Check →</Text>
              </TouchableOpacity>
            ) : (
              <View style={[
                styles.statusBadge,
                item.status === 'passed' ? styles.statusPassed : styles.statusFailed,
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: item.status === 'passed' ? COLORS.success : COLORS.danger },
                ]}>
                  {item.status === 'passed' ? 'Passed' : 'Failed'}
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.warning },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.warning },
  badge: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
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
  soNumber: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  customer: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  startBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  startBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPassed: { backgroundColor: '#E8F5E9' },
  statusFailed: { backgroundColor: '#FFEBEE' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
