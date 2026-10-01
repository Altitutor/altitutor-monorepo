import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useDueFlashcardCount } from '@/features/flashcards/flashcard-hooks';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();
  const dueCount = useDueFlashcardCount();

  return (
    <NativeTabs backgroundColor={colors.backgroundElement} tintColor={colors.primary}>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="classes">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
        <NativeTabs.Trigger.Label>Classes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resources">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>Resources</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="flashcards">
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.on.rectangle', selected: 'rectangle.fill.on.rectangle.fill' }} md="style" />
        <NativeTabs.Trigger.Label>Flashcards</NativeTabs.Trigger.Label>
        {dueCount.data ? <NativeTabs.Trigger.Badge>{dueCount.data > 99 ? '99+' : String(dueCount.data)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="billing">
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="credit_card" />
        <NativeTabs.Trigger.Label>Billing</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
