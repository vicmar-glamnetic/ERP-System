import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { PickTasksScreen } from '../screens/wms/PickTasksScreen';
import { ReceiveScreen } from '../screens/wms/ReceiveScreen';
import { PutawayScreen } from '../screens/wms/PutawayScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();

export function WMSNavigator() {
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
            Putaway: focused ? 'archive' : 'archive-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={(icons[route.name] ?? 'ellipse') as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Tasks" component={PickTasksScreen} options={{ title: 'Pick Tasks' }} />
      <Tab.Screen name="Receive" component={ReceiveScreen} options={{ title: 'Receive Stock' }} />
      <Tab.Screen name="Putaway" component={PutawayScreen} options={{ title: 'Putaway' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
