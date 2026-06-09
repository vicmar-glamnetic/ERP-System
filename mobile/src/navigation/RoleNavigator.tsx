import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { WMSNavigator } from './WMSNavigator';
import { TMSNavigator } from './TMSNavigator';
import { AdminNavigator } from './AdminNavigator';
import { CheckerNavigator } from './CheckerNavigator';
import { ProfileScreen } from '../screens/shared/ProfileScreen';

const WMS_ROLES = ['wh_operator', 'wh_supervisor'];
const TMS_ROLES = ['driver'];
const ADMIN_ROLES = ['dispatcher', 'operations_manager', 'system_admin', 'finance_officer'];
const CHECKER_ROLES = ['checker'];

export function RoleNavigator() {
  const { state } = useAuth();
  const role = state.user?.role ?? '';

  if (WMS_ROLES.includes(role)) return <WMSNavigator />;
  if (TMS_ROLES.includes(role)) return <TMSNavigator />;
  if (ADMIN_ROLES.includes(role)) return <AdminNavigator />;
  if (CHECKER_ROLES.includes(role)) return <CheckerNavigator />;

  return <ProfileScreen />;
}
