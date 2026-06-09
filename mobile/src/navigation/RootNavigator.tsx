import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../auth/LoginScreen';
import { RoleNavigator } from './RoleNavigator';

export function RootNavigator() {
  const { state } = useAuth();

  if (!state.isAuthenticated) return <LoginScreen />;
  return <RoleNavigator />;
}
