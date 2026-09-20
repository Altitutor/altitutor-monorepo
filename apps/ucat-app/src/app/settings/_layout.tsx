import { Platform } from "react-native";
import { Stack } from "expo-router/stack";
import { useColors } from "@/components/ui";
export default function Layout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: false,
        headerLargeTitleStyle: { color: c.text },
        headerTitleStyle: { color: c.text },

        headerTransparent: Platform.OS === "ios",
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Menu" }} />
      <Stack.Screen
        name="app-settings"
        options={{ title: "App settings", headerLargeTitleEnabled: false }}
      />
      <Stack.Screen
        name="profile"
        options={{ title: "My profile", headerLargeTitleEnabled: false }}
      />
      <Stack.Screen
        name="plan"
        options={{ title: "Plan", headerLargeTitleEnabled: false }}
      />
    </Stack>
  );
}
