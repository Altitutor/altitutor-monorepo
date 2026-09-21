import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router/stack";
import { useRouter } from "expo-router";
import { withHaptic } from "@/lib/haptics";
import { useColors } from "./ui";

export function HeaderActions({
  onMenu,
  onCalculator,
  onFlag,
  flagged = false,
  hideNotifications = false,
}: {
  onMenu?: () => void;
  onCalculator?: () => void;
  onFlag?: () => void;
  flagged?: boolean;
  hideNotifications?: boolean;
}) {
  const router = useRouter();
  const c = useColors();
  const notifications = () => router.push("/notifications");
  if (process.env.EXPO_OS === "ios")
    return (
      <>
        {onMenu && (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="line.3.horizontal"
              accessibilityLabel="Attempt menu"
              onPress={withHaptic(onMenu)}
            />
          </Stack.Toolbar>
        )}
        <Stack.Toolbar placement="right">
          {onCalculator ? (
            <Stack.Toolbar.Button
              icon="plus.forwardslash.minus"
              accessibilityLabel="Calculator"
              onPress={withHaptic(onCalculator)}
            />
          ) : !hideNotifications ? (
            <Stack.Toolbar.Button
              icon="bell"
              accessibilityLabel="Notifications"
              onPress={withHaptic(notifications)}
            />
          ) : null}
          {!onCalculator && !hideNotifications && (
            <Stack.Toolbar.Button
              icon="line.3.horizontal"
              accessibilityLabel="Menu"
              onPress={withHaptic(() => router.push("/settings"))}
            >
              Menu
            </Stack.Toolbar.Button>
          )}
          {onFlag && (
            <Stack.Toolbar.Button
              icon={flagged ? "flag.fill" : "flag"}
              accessibilityLabel={flagged ? "Unflag question" : "Flag question"}
              onPress={withHaptic(onFlag)}
            />
          )}
        </Stack.Toolbar>
      </>
    );
  const button = (label: string, symbol: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={withHaptic(action)}
      style={{ padding: 12 }}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={{
          uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${symbol === "flag" && flagged ? c.accent : "none"}" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${symbol === "menu" ? '<path d="M4 6h16M4 12h16M4 18h16"/>' : symbol === "calculator" ? '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M15 11h1M8 15h1M15 15h1M8 19h1M15 19h1"/>' : symbol === "flag" ? '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>' : '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'}</svg>`)}`,
        }}
        style={{ width: 24, height: 24 }}
      />
    </Pressable>
  );
  return (
    <Stack.Screen
      options={{
        headerLeft: onMenu
          ? () => button("Attempt menu", "menu", onMenu)
          : undefined,
        headerRight: () => (
          <View style={{ flexDirection: "row" }}>
            {onCalculator
              ? button("Calculator", "calculator", onCalculator)
              : !hideNotifications
                ? button("Notifications", "bell", notifications)
                : null}
            {!onCalculator &&
              !hideNotifications &&
              button("Menu", "menu", () => router.push("/settings"))}
            {onFlag &&
              button(
                flagged ? "Unflag question" : "Flag question",
                "flag",
                onFlag,
              )}
          </View>
        ),
      }}
    />
  );
}
