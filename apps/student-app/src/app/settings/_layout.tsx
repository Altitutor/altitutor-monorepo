import { Stack } from 'expo-router';

import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export default function SettingsLayout() {
  const options = useNativeStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerLargeTitleEnabled: false }}>
      <Stack.Screen name="index" options={{ title: 'Menu' }} />
      <Stack.Screen name="app-settings" options={{ title: 'App settings' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
    </Stack>
  );
}
