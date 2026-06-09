import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { PickTasksScreen } from '../screens/wms/PickTasksScreen';
import { ReceiveScreen } from '../screens/wms/ReceiveScreen';
import { RouteListScreen } from '../screens/shared/RouteListScreen';
import { LiveGPSScreen } from '../screens/admin/LiveGPSScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();

export function AdminNavigator() {
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
            Tasks: focused ? 'checkmark-done' : 'checkmark-done-outline',
            Receive: focused ? 'download' : 'download-outline',
            Routes: focused ? 'map' : 'map-outline',
            'Live GPS': focused ? 'navigate' : 'navigate-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={(icons[route.name] ?? 'ellipse') as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Tasks" component={PickTasksScreen} options={{ title: 'Pick Tasks' }} />
      <Tab.Screen name="Receive" component={ReceiveScreen} options={{ title: 'Receive Stock' }} />
      <Tab.Screen name="Routes" component={RouteListScreen} options={{ title: 'Routes' }} />
      <Tab.Screen name="Live GPS" component={LiveGPSScreen} options={{ title: 'Live GPS' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
