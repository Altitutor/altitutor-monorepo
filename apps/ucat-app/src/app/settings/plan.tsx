import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  Meter,
  Screen,
  useColors,
} from "@/components/ui";
import { AppIcon } from "@/components/app-icon";
import { dataApi } from "@/features/dashboard/api";
import { openWebSettings } from "@/features/settings/open-web-settings";

export default function Plan() {
  const c = useColors();
  const q = useQuery({ queryKey: ["quota"], queryFn: dataApi.quota });
  const free = q.data?.onlineTier === "free" && !q.data.isQuotaExempt;
  const highlights = free
    ? ["Daily practice access", "Progress saved", "Upgrade anytime"]
    : [
        "Unlimited online access",
        "All mocks and analytics",
        "Practice discounts",
      ];
  return (
    <Screen>
      {q.isPending ? (
        <Loading variant="card" count={2} />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <Group title="Current plan">
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <AppIcon name="plan" color={c.accent} size={32} />
              <Copy large>
                {free
                  ? "UCAT Free"
                  : q.data.onlineTier === "unlimited_trial"
                    ? "UCAT Unlimited trial"
                    : "UCAT Unlimited"}
              </Copy>
            </View>
            <Copy muted>
              {free
                ? "Build your UCAT routine with daily access across the platform."
                : "Unlimited access to the entire Altitutor UCAT platform."}
            </Copy>
            {highlights.map((highlight) => (
              <View key={highlight} style={{ flexDirection: "row", gap: 10 }}>
                <Text style={{ color: c.accent }}>✓</Text>
                <Copy>{highlight}</Copy>
              </View>
            ))}
            <Action
              title="Manage subscription"
              onPress={() =>
                void openWebSettings("/settings/plan/subscription")
              }
            />
          </Group>
          {free && (
            <Group title="Your free quotas" dividers>
              {q.data.areas.map((area) => (
                <View key={area.area} style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    <Copy>{area.label}</Copy>
                    <Text
                      style={{
                        color: area.atLimit ? c.danger : c.secondary,
                        fontSize: 14,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {area.disabled || area.limit <= 0
                        ? "Only on Unlimited"
                        : `${area.used} / ${area.limit} this ${area.period}`}
                    </Text>
                  </View>
                  <Meter
                    value={area.limit > 0 ? (area.used / area.limit) * 100 : 0}
                  />
                </View>
              ))}
              <Action
                title="Explore paid plans"
                secondary
                onPress={() => void openWebSettings("/settings/plan")}
              />
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}
