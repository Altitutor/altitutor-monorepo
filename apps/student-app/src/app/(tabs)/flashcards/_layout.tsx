import { Stack } from 'expo-router';

import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export default function FlashcardsLayout() {
  const options = useNativeStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Flashcards' }} />
    </Stack>
  );
}
