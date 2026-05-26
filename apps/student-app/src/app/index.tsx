import { Redirect } from 'expo-router';

import { FullScreenLoading } from '@/components/student-ui';
import { useAuth } from '@/providers/auth-provider';

export default function EntryScreen() {
  const { loading, session } = useAuth();

  if (loading) return <FullScreenLoading label="Loading your account..." />;
  return <Redirect href={session ? '/(tabs)/dashboard' : '/(auth)/login'} />;
}
