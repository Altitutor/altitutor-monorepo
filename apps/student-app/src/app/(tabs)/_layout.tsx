import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { FullScreenLoading } from '@/components/student-ui';
import { useAuth } from '@/providers/auth-provider';

export default function TabsLayout() {
  const { loading, session } = useAuth();
  if (loading) return <FullScreenLoading label="Loading student home..." />;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <AppTabs />;
}
