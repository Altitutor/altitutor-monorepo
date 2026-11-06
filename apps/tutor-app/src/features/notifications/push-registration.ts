import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { NotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { notificationFromPush } from '@/features/notifications/notification-routing';
import { tutorWebJson } from '@/lib/tutor-web';

const channelId = 'tutor-updates';
const apiPath = '/api/mobile-push';
const platform = process.env.EXPO_OS;
const native = platform === 'android' || platform === 'ios';
const projectId = process.env.EXPO_PUBLIC_TUTOR_EAS_PROJECT_ID || Constants.easConfig?.projectId;
const tokenKey = (userId: string) => `tutor-push-token:${userId}`;
const confirmedKey = (userId: string) => `tutor-push-confirmed:${userId}`;
const disableKey = (userId: string) => `tutor-push-disable:${userId}`;

let pending = Promise.resolve();
function serializeRegistration<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export const pushAvailable = native && Boolean(projectId) && Constants.executionEnvironment !== 'storeClient';

let notifications: Promise<typeof import('expo-notifications')> | undefined;

function notificationModule() {
  // Expo Go on Android throws on import, even if registration is never attempted.
  notifications ??= import('expo-notifications').then((module) => {
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return module;
  });
  return notifications;
}

export async function getPushPreference(userId: string) {
  const result = await tutorWebJson<{ categories: { tutor_updates: boolean } }>(apiPath, 'GET', undefined, userId);
  return result.categories.tutor_updates;
}

export function setPushPreference(userId: string, enabled: boolean) {
  return tutorWebJson(apiPath, 'PATCH', { category: 'tutor_updates', enabled }, userId);
}

export async function devicePushEnabled(userId: string) {
  if (!pushAvailable) return false;
  const [token, confirmed, disabling, permission] = await Promise.all([
    AsyncStorage.getItem(tokenKey(userId)),
    AsyncStorage.getItem(confirmedKey(userId)),
    AsyncStorage.getItem(disableKey(userId)),
    notificationModule().then((module) => module.getPermissionsAsync()),
  ]);
  return Boolean(!disabling && token && token === confirmed && permission.granted);
}

async function getDeviceToken(requestPermission: boolean) {
  if (!pushAvailable || !projectId) throw new Error('Push requires a configured Tutor app build.');
  const module = await notificationModule();
  if (platform === 'android') {
    await module.setNotificationChannelAsync(channelId, {
      name: 'Tutor updates',
      importance: module.AndroidImportance.DEFAULT,
    });
  }
  const current = await module.getPermissionsAsync();
  const permission = current.granted || !requestPermission ? current : await module.requestPermissionsAsync();
  if (!permission.granted) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      module.getExpoPushTokenAsync({ projectId }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Getting a push token timed out. Try again.')), 20_000);
      }),
    ]);
    return result.data;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function removeToken(userId: string, token: string) {
  await tutorWebJson(apiPath, 'DELETE', { token }, userId);
  await AsyncStorage.multiRemove([tokenKey(userId), confirmedKey(userId), disableKey(userId)]);
}

async function registerToken(userId: string, token: string, previous: string | null) {
  if (previous && previous !== token) await removeToken(userId, previous);
  // Keep the token locally if the request's response is lost, so logout can
  // still revoke a registration that the server accepted.
  await AsyncStorage.setItem(tokenKey(userId), token);
  await tutorWebJson(apiPath, 'POST', { token, platform }, userId);
  await AsyncStorage.setItem(confirmedKey(userId), token);
}

export function enablePushNotifications(userId: string) {
  return serializeRegistration(async () => {
    const token = await getDeviceToken(true);
    if (!token) throw new Error('Allow notifications in device settings to enable push.');
    await AsyncStorage.removeItem(disableKey(userId));
    await registerToken(userId, token, await AsyncStorage.getItem(tokenKey(userId)));
  });
}

export function disablePushNotifications(userId: string) {
  return serializeRegistration(async () => {
    const token = await AsyncStorage.getItem(tokenKey(userId));
    if (token) {
      await AsyncStorage.setItem(disableKey(userId), '1');
      await removeToken(userId, token);
    }
    if (pushAvailable) {
      await notificationModule().then((module) => Promise.allSettled([
        module.dismissAllNotificationsAsync(),
        module.clearLastNotificationResponseAsync(),
      ])).catch(() => undefined);
    }
  });
}

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!pushAvailable || !userId) return;
    let active = true;
    let tokenSubscription: { remove: () => void } | undefined;
    const refresh = () => {
      void serializeRegistration(async () => {
        const previous = await AsyncStorage.getItem(tokenKey(userId));
        if (!active || !previous) return;
        if (await AsyncStorage.getItem(disableKey(userId))) {
          await removeToken(userId, previous);
          return;
        }
        const token = await getDeviceToken(false);
        if (!active) return;
        if (token) await registerToken(userId, token, previous);
        else await removeToken(userId, previous);
      }).catch(() => {
        // Reconcile on the next foreground or token change after a network failure.
      });
    };
    refresh();
    const state = AppState.addEventListener('change', (value) => {
      if (value === 'active') refresh();
    });
    void notificationModule().then((module) => {
      if (active) tokenSubscription = module.addPushTokenListener(refresh);
    }).catch(() => undefined);
    return () => {
      active = false;
      tokenSubscription?.remove();
      state.remove();
    };
  }, [userId]);
}

export function usePushNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (!pushAvailable) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void notificationModule().then((module) => {
      if (!active) return;
      let lastHandled: string | undefined;
      function open(response: NotificationResponse) {
        const { request } = response.notification;
        if (lastHandled === request.identifier) return;
        lastHandled = request.identifier;
        const notificationId = notificationFromPush(request.content.data);
        if (notificationId) router.push({ pathname: '/notifications', params: { notificationId } });
        void module.clearLastNotificationResponseAsync().catch(() => undefined);
      }
      const initial = module.getLastNotificationResponse();
      if (initial) open(initial);
      subscription = module.addNotificationResponseReceivedListener(open);
    }).catch(() => undefined);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);
}
