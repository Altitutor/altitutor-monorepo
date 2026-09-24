import { Tabs } from "expo-router";
import { useColors } from "@/components/ui";
export default function AppTabs() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarStyle: { backgroundColor: c.card },
      }}
    >
      {["(home)", "learn", "practice", "progress"].map((name, i) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: ["Home", "Learn", "Practice", "Progress"][i],
          }}
        />
      ))}
    </Tabs>
  );
}
