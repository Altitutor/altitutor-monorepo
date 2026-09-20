import { NativeButton } from "@/components/native-button";
import { useEffect, useState } from "react";
import { Alert, AppState, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/components/ui";
import { discardAttempt, loadActiveAttempt } from "./current-attempt";
export function AttemptBanner() {
  const path = usePathname();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["active"],
    queryFn: loadActiveAttempt,
    refetchInterval: 30000,
  });
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ["active"] });
  }, [path, client]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active")
        void client.invalidateQueries({ queryKey: ["active"] });
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [client]);
  const active = query.data?.active;
  if (
    !active ||
    ["/exam", "/calculator", "/exam-menu", "/question-navigator"].includes(path)
  )
    return null;
  const seconds = active.currentSegmentEndsAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(active.currentSegmentEndsAt) - now) / 1000),
      )
    : null;
  const status =
    seconds !== null
      ? seconds > 0
        ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`
        : "Time elapsed"
      : active.engineSnapshot.phase === "instructions"
        ? "Reading instructions"
        : `Question ${active.engineSnapshot.currentIndex + 1} · In progress`;
  return (
    <View
      style={{
        backgroundColor: c.tint,
        paddingTop: insets.top,
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <NativeButton
        close
        title="Discard current attempt"
        disabled={busy}
        onPress={() =>
          Alert.alert(
            "Discard this attempt?",
            "Your answers in this attempt will be discarded.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => {
                  setBusy(true);
                  void discardAttempt(active)
                    .then(() =>
                      client.invalidateQueries({ queryKey: ["active"] }),
                    )
                    .catch((e) =>
                      Alert.alert(
                        "Unable to discard",
                        e instanceof Error ? e.message : "Try again.",
                      ),
                    )
                    .finally(() => setBusy(false));
                },
              },
            ],
          )
        }
      />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontWeight: "600" }}>
          {active.label}
        </Text>
        <Text style={{ color: c.secondary, fontSize: 12 }}>{status}</Text>
      </View>
      <NativeButton
        title="Resume"
        disabled={busy}
        onPress={() =>
          router.push({
            pathname: "/exam",
            params: {
              kind: active.kind,
              id: active.resourceId,
              resume: "true",
            },
          })
        }
      />
    </View>
  );
}
