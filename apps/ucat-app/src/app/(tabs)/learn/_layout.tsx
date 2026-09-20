import { Platform } from "react-native";
import { Stack } from "expo-router/stack";
import { useColors } from "@/components/ui";
export default function Layout() {
  const c = useColors();
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
      }}
    >
      <Stack.Screen name="index" options={{ title: "Learn" }} />
      <Stack.Screen
        name="section"
        options={{ headerLargeTitleEnabled: false }}
      />
    </Stack>
  );
}
