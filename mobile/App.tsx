import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { COLORS } from './src/constants';
import { startOfflineFlush } from './src/api/client';
import { apiClient } from './src/api/client';

// expo-notifications push support was removed from Expo Go in SDK 53.
// We lazy-require it so the module never initializes when running in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;

if (!IS_EXPO_GO) {
  // Dynamic require so Metro doesn't initialize the native module in Expo Go
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO || !Notifications) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'erp-mobile',
    });
    return tokenData.data;
  } catch {
    return null;
  }
}

function AppContent() {
  const { state, restoreSession } = useAuth();
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    restoreSession();

    // Start offline queue flush listener
    const unsubscribeNetInfo = startOfflineFlush();

    // Register push notifications
    registerForPushNotifications().then((token) => {
      if (token) {
        apiClient.post('/tms/push-token', { push_token: token }).catch(() => {});
      }
    });

    if (!IS_EXPO_GO) {
      notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {});
      responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {});
    }

    return () => {
      unsubscribeNetInfo();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [restoreSession]);

  if (state.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
