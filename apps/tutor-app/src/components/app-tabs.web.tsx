import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.primary,
      tabBarInactiveTintColor: theme.textSecondary,
      tabBarStyle: { backgroundColor: theme.backgroundElement },
    }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarAccessibilityLabel: 'Classes' }} />
      <Tabs.Screen name="documentation" options={{ title: 'Documentation', tabBarAccessibilityLabel: 'Documentation' }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources', tabBarAccessibilityLabel: 'Resources' }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarAccessibilityLabel: 'Search' }} />
    </Tabs>
  );
}
