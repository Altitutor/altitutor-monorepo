import { Platform } from "react-native";
import { Stack } from "expo-router/stack";
import { useColors } from "@/components/ui";
import { useAttemptBannerStackScreenOptions } from "@/features/practice/components/attempt-banner-inset";
export default function Layout() {
  const c = useColors();
  const attemptBannerStackOptions = useAttemptBannerStackScreenOptions();
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerLargeTitleStyle: { color: c.text },
        headerTitleStyle: { color: c.text },

        headerTransparent: Platform.OS === "ios",
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
        ...attemptBannerStackOptions,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
