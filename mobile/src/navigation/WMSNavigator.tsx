import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { PickTasksScreen } from '../screens/wms/PickTasksScreen';
import { ReceiveScreen } from '../screens/wms/ReceiveScreen';
import { PutawayScreen } from '../screens/wms/PutawayScreen';
import { CheckTasksScreen } from '../screens/wms/CheckTasksScreen';
import { CheckDetailScreen } from '../screens/wms/CheckDetailScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';
import type { CheckTask } from '../types';

type WMSStackParamList = {
  WMSTabs: undefined;
  CheckDetail: { task: CheckTask };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<WMSStackParamList>();

function WMSTabNavigator() {
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
          const icons: Record<string, [string, string]> = {
            Tasks:   ['checkbox',              'checkbox-outline'],
            Receive: ['download',              'download-outline'],
            Putaway: ['arrow-up-circle',       'arrow-up-circle-outline'],
            Check:   ['checkmark-circle',      'checkmark-circle-outline'],
            Profile: ['person',                'person-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Tasks"   component={PickTasksScreen}  options={{ title: 'Pick Tasks' }} />
      <Tab.Screen name="Receive" component={ReceiveScreen}    options={{ title: 'Receive Stock' }} />
      <Tab.Screen name="Putaway" component={PutawayScreen}    options={{ title: 'Putaway' }} />
      <Tab.Screen
        name="Check"
        component={CheckTasksScreen}
        options={{
          title: 'Check Tasks',
          tabBarActiveTintColor: COLORS.warning,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function WMSNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WMSTabs"
        component={WMSTabNavigator}
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
