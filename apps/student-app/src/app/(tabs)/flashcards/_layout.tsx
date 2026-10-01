import { Stack } from 'expo-router';

import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export default function FlashcardsLayout() {
  const options = useNativeStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Flashcards' }} />
      <Stack.Screen name="manage/index" options={{ title: 'Manage flashcards', headerLargeTitleEnabled: false }} />
      <Stack.Screen name="manage/[flashcardId]" options={{ title: 'Review card', headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
