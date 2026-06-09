import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MyRouteScreen } from '../screens/tms/MyRouteScreen';
import { DeliverScreen } from '../screens/tms/DeliverScreen';
import { FuelLogScreen } from '../screens/tms/FuelLogScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function RouteStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MyRoute"
        component={MyRouteScreen}
        options={{
          title: 'My Route',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <Stack.Screen
        name="Deliver"
        component={DeliverScreen}
        options={{
          title: 'Confirm Delivery',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Stack.Navigator>
  );
}

export function TMSNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { borderTopColor: COLORS.border },
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            'My Route': focused ? 'map' : 'map-outline',
            'Fuel Log': focused ? 'water' : 'water-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={(icons[route.name] ?? 'ellipse') as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="My Route" component={RouteStack} />
      <Tab.Screen
        name="Fuel Log"
        component={FuelLogScreen}
        options={{
          headerShown: true,
          title: 'Fuel Log',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Tab.Navigator>
  );
}
