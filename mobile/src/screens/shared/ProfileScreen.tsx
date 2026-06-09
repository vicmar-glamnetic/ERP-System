import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../constants';

const ROLE_COLORS: Record<string, string> = {
  system_admin: '#7B1FA2',
  operations_manager: '#1565C0',
  wh_supervisor: '#0F6E56',
  wh_operator: '#2E7D32',
  dispatcher: '#854F0B',
  driver: '#E65100',
  hr_manager: '#AD1457',
  hr_staff: '#C62828',
};

export function ProfileScreen() {
  const { state, logout } = useAuth();
  const user = state.user;

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] ?? COLORS.textMuted;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{user.full_name}</Text>

      <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
        <Text style={styles.roleText}>{user.role.replace(/_/g, ' ').toUpperCase()}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="Employee Code" value={user.employee_code} />
        <InfoRow label="Department" value={user.department ?? '—'} />
      </View>

      <Text style={styles.sectionTitle}>Permissions</Text>
      <View style={styles.infoCard}>
        {user.permissions.length > 0 ? (
          user.permissions.map((p) => (
            <Text key={p} style={styles.permission}>
              • {p}
            </Text>
          ))
        ) : (
          <Text style={styles.permission}>No permissions assigned</Text>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
  },
  roleBadge: {
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 24,
  },
  roleText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  rowValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  permission: { fontSize: 13, color: COLORS.text, paddingVertical: 4 },
  logoutButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
