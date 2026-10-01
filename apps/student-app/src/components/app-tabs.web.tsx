import { Tabs } from 'expo-router';

import { useDueFlashcardCount } from '@/features/flashcards/flashcard-hooks';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();
  const dueCount = useDueFlashcardCount();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarStyle: { backgroundColor: colors.backgroundElement },
      }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes' }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources' }} />
      <Tabs.Screen name="flashcards" options={{ title: 'Flashcards', tabBarBadge: dueCount.data || undefined }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing' }} />
    </Tabs>
  );
}
