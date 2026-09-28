import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { UcatPushCategory } from "@altitutor/shared";

import { api } from "@/lib/api";

const storageKey = "ucat-push-token";
const channelId = "ucat-updates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getPushPreferences(): Promise<Record<UcatPushCategory, boolean>> {
  const result = await api<{ categories: Record<UcatPushCategory, boolean> }>("/mobile-push");
  return result.categories;
}

export async function setPushPreference(category: UcatPushCategory, enabled: boolean) {
  await api("/mobile-push", { method: "PATCH", body: { category, enabled } });
}

export async function pushEnabledOnDevice() {
  return Platform.OS !== "web" && Boolean(await AsyncStorage.getItem(storageKey));
}

async function currentPushToken(requestPermission: boolean): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: "UCAT updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted || !requestPermission
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (requestPermission) throw new Error("Notification permission was not granted.");
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("EAS project ID is not configured.");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function enablePushNotifications() {
  const token = await currentPushToken(true);
  if (!token) throw new Error("Remote notifications require the native UCAT app.");
  const previous = await AsyncStorage.getItem(storageKey);
  if (previous && previous !== token) {
    await api("/mobile-push", { method: "DELETE", body: { token: previous } });
  }
  await api("/mobile-push", { method: "POST", body: { token, platform: Platform.OS } });
  await AsyncStorage.setItem(storageKey, token);
}

export async function disablePushNotifications() {
  const token = await AsyncStorage.getItem(storageKey);
  if (!token) return;
  await api("/mobile-push", { method: "DELETE", body: { token } });
  await AsyncStorage.removeItem(storageKey);
}

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === "web") return;
    let active = true;
    async function refresh() {
      const previous = await AsyncStorage.getItem(storageKey);
      if (!previous || !active) return;
      const token = await currentPushToken(false);
      if (!active) return;
      if (!token) {
        await disablePushNotifications();
      } else {
        if (previous !== token) {
          await api("/mobile-push", { method: "DELETE", body: { token: previous } });
        }
        await api("/mobile-push", { method: "POST", body: { token, platform: Platform.OS } });
        await AsyncStorage.setItem(storageKey, token);
      }
    }
    void refresh().catch((error) => console.warn("[ucat push] Registration refresh failed", error));
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch((error) => console.warn("[ucat push] Registration refresh failed", error));
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, [userId]);
}

export function useNotificationNavigation(ready: boolean) {
  useEffect(() => {
    if (!ready || Platform.OS === "web") return;
    function redirect(notification: Notifications.Notification) {
      if (notification.request.content.data?.destination === "inbox") {
        router.push("/notifications");
      }
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
  }, [ready]);
}
