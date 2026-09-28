import { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { pushCategoryLabels, ucatPushCategories, type UcatPushCategory } from "@altitutor/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Group, Screen, Failure, Loading, useColors } from "@/components/ui";
import { Choice } from "@/components/practice-controls";
import { useAppTheme } from "@/features/settings/theme";
import { dataApi } from "@/features/dashboard/api";
import { api } from "@/lib/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPreferences,
  pushEnabledOnDevice,
  setPushPreference,
} from "@/features/notifications/push";
export default function AppSettings() {
  const { preference, setPreference } = useAppTheme();
  const colors = useColors();
  const client = useQueryClient();
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [devicePending, setDevicePending] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const push = useQuery({ queryKey: ["push-preferences"], queryFn: getPushPreferences });
  const savePush = useMutation({
    mutationFn: ({ category, enabled }: { category: UcatPushCategory; enabled: boolean }) =>
      setPushPreference(category, enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: ["push-preferences"] }),
  });
  useEffect(() => {
    void pushEnabledOnDevice().then(setDeviceEnabled);
  }, []);
  async function toggleDevice(enabled: boolean) {
    setDevicePending(true);
    setPushError(null);
    try {
      if (enabled) await enablePushNotifications();
      else await disablePushNotifications();
      setDeviceEnabled(enabled);
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Unable to update notifications.");
    } finally {
      setDevicePending(false);
    }
  }
  const q = useQuery({ queryKey: ["profile"], queryFn: dataApi.profile });
  const save = useMutation({
    mutationFn: (timezone: string) =>
      api("/profile", { method: "PATCH", body: { timezone } }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["profile"] }),
        client.invalidateQueries({ queryKey: ["activity"] }),
        client.invalidateQueries({ queryKey: ["plan"] }),
      ]);
    },
  });
  const modes = ["system", "light", "dark"] as const;
  const zones = q.data?.timezoneOptions ?? [];
  return (
    <Screen>
      <Group dividers compact>
        <Choice
          label="Appearance"
          value={modes.indexOf(preference)}
          onChange={(v) => setPreference(modes[v] ?? "system")}
          options={[
            { value: 0, label: "System" },
            { value: 1, label: "Light" },
            { value: 2, label: "Dark" },
          ]}
        />
        {q.isPending ? (
          <Loading variant="rows" />
        ) : q.error ? (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ) : (
          <Choice
            label="Timezone"
            value={zones.indexOf(q.data?.timezone ?? "")}
            onChange={(v) => {
              if (zones[v] && !save.isPending) save.mutate(zones[v]);
            }}
            options={zones.map((label, value) => ({
              value,
              label: label.replaceAll("_", " "),
            }))}
          />
        )}
      </Group>
      {save.error && <Failure error={save.error} />}
      <Group>
        <View style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Push notifications on this device</Text>
            <Switch value={deviceEnabled} onValueChange={(value) => void toggleDevice(value)}
              disabled={devicePending || Platform.OS === "web"} />
          </View>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>
            Choose which updates reach your phone. Categories sync across your devices.
          </Text>
          {ucatPushCategories.map((category) => (
            <View key={category} style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{pushCategoryLabels[category]}</Text>
              <Switch value={push.data?.[category] ?? (category !== "quota_limits" && category !== "new_content")}
                onValueChange={(enabled) => savePush.mutate({ category, enabled })}
                disabled={push.isPending || savePush.isPending} />
            </View>
          ))}
          {pushError ? <Text selectable style={{ color: colors.danger }}>{pushError}</Text> : null}
        </View>
      </Group>
      {push.error && <Failure error={push.error} />}
      {savePush.error && <Failure error={savePush.error} />}
    </Screen>
  );
}
