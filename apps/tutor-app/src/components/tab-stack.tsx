import { Stack } from 'expo-router';

import { useHeaderActions } from '@/components/header-actions';
import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export function TabStack({ title }: { title: string }) {
  const options = useNativeStackOptions();
  const headerActions = useHeaderActions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ ...headerActions, title }} />
    </Stack>
  );
}
