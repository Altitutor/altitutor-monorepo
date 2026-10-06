import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { studentWebUrl } from '@/lib/student-web';

const storageKey = 'student-push-token';
const channelId = 'student-updates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function pushApi(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Sign in to manage push notifications.');
  const response = await fetch(studentWebUrl('/api/mobile-push'), {
    method,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? 'Unable to update push notifications.');
  }
  return response.json() as Promise<unknown>;
}

export async function getPushPreferences(): Promise<Record<'sessions' | 'payments', boolean>> {
  const result = await pushApi('GET') as { categories: Record<'sessions' | 'payments', boolean> };
  return result.categories;
}

export async function setPushPreference(category: 'sessions' | 'payments', enabled: boolean) {
  await pushApi('PATCH', { category, enabled });
}

export async function pushEnabledOnDevice() {
  return Platform.OS !== 'web' && Boolean(await AsyncStorage.getItem(storageKey));
}

async function currentPushToken(requestPermission: boolean): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Student updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted || !requestPermission
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (requestPermission) throw new Error('Notification permission was not granted.');
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is not configured.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function enablePushNotifications() {
  const token = await currentPushToken(true);
  if (!token) throw new Error('Remote notifications require the native student app.');
  const previous = await AsyncStorage.getItem(storageKey);
  if (previous && previous !== token) await pushApi('DELETE', { token: previous });
  await pushApi('POST', { token, platform: Platform.OS });
  await AsyncStorage.setItem(storageKey, token);
}

export async function disablePushNotifications() {
  const token = await AsyncStorage.getItem(storageKey);
  if (!token) return;
  await pushApi('DELETE', { token });
  await AsyncStorage.removeItem(storageKey);
}

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    let active = true;
    async function refresh() {
      const previous = await AsyncStorage.getItem(storageKey);
      if (!previous || !active) return;
      const token = await currentPushToken(false);
      if (!active) return;
      if (!token) {
        await disablePushNotifications();
      } else {
        if (previous !== token) await pushApi('DELETE', { token: previous });
        await pushApi('POST', { token, platform: Platform.OS });
        await AsyncStorage.setItem(storageKey, token);
      }
    }
    void refresh().catch((error) => console.warn('[student push] Registration refresh failed', error));
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch((error) => console.warn('[student push] Registration refresh failed', error));
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, [userId]);
}

export function useNotificationNavigation(authenticated: boolean) {
  useEffect(() => {
    if (!authenticated || Platform.OS === 'web') return;
    function redirect(notification: Notifications.Notification) {
      const destination = notification.request.content.data?.destination;
      if (destination === 'classes') router.push('/(tabs)/classes');
      if (destination === 'billing') router.push('/(tabs)/billing');
    }
    const initial = Notifications.getLastNotificationResponse();
    if (initial?.notification) {
      redirect(initial.notification);
      void Notifications.clearLastNotificationResponseAsync();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => redirect(response.notification),
    );
    return () => subscription.remove();
  }, [authenticated]);
}
