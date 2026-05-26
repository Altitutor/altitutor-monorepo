import { Stack } from 'expo-router';

import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export default function DashboardLayout() {
  const options = useNativeStackOptions();
  return <Stack screenOptions={options} />;
}
