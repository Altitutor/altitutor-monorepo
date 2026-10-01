import { Redirect, Stack } from 'expo-router';

import { FullScreenLoading } from '@/components/student-ui';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  if (loading) return <FullScreenLoading label="Checking session..." />;
  if (session) return <Redirect href="/(tabs)/dashboard" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
