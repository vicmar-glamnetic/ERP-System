import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { CheckTasksScreen } from '../screens/wms/CheckTasksScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();

export function CheckerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { borderTopColor: COLORS.border },
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            'Check Tasks': focused ? 'shield-checkmark' : 'shield-checkmark-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={(icons[route.name] ?? 'ellipse') as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Check Tasks"
        component={CheckTasksScreen}
        options={{ title: 'Check Tasks' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
