import { Redirect, Stack, useSegments } from 'expo-router';

import { FullScreenLoading } from '@/components/student-ui';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  const segments = useSegments() as readonly string[];
  if (loading) return <FullScreenLoading label="Checking session..." />;
  if (session && !segments.includes('reset-password')) return <Redirect href="/(tabs)/dashboard" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
