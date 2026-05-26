import { Stack } from 'expo-router';

import { useNativeStackOptions } from '@/hooks/use-native-stack-options';

export default function ResourcesLayout() {
  const options = useNativeStackOptions();
  return <Stack screenOptions={options} />;
}
