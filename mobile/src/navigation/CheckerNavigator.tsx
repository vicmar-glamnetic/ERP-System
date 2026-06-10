import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { CheckTasksScreen } from '../screens/wms/CheckTasksScreen';
import { CheckDetailScreen } from '../screens/wms/CheckDetailScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';
import type { CheckTask } from '../types';

type CheckerStackParamList = {
  CheckerTabs: undefined;
  CheckDetail: { task: CheckTask };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<CheckerStackParamList>();

function CheckerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.warning,
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
      <Tab.Screen name="Check Tasks" component={CheckTasksScreen} options={{ title: 'Check Tasks' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function CheckerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CheckerTabs"
        component={CheckerTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CheckDetail"
        component={CheckDetailScreen}
        options={({ route }) => ({
          title: `Check · ${route.params.task.so_number}`,
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        })}
      />
    </Stack.Navigator>
  );
}
