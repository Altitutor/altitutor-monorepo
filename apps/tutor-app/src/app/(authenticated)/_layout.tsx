import { Stack } from 'expo-router';

import { usePushNavigation, usePushRegistration } from '@/features/notifications/push-registration';
import { useNativeStackOptions } from '@/hooks/use-native-stack-options';
import { useAuth } from '@/providers/auth-provider';

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.55, 1],
  sheetGrabberVisible: true,
};

export default function AuthenticatedLayout() {
  const options = useNativeStackOptions();
  const { session } = useAuth();
  usePushRegistration(session?.user.id);
  usePushNavigation();
  return (
    <Stack screenOptions={{ ...options, headerLargeTitleEnabled: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Tutor' }} />
      <Stack.Screen name="session/[sessionId]" options={{ title: 'Session' }} />
      <Stack.Screen name="class/[classId]" options={{ title: 'Class' }} />
      <Stack.Screen name="log-session/[sessionId]" options={{ title: 'Log session' }} />
      <Stack.Screen name="documentation-document/[documentId]" options={{ title: 'Document' }} />
      <Stack.Screen name="resource-subject/[subjectId]" options={{ title: 'Topics' }} />
      <Stack.Screen name="resource-topic/[topicId]" options={{ title: 'Topic' }} />
      <Stack.Screen name="resource-file/[fileId]" options={{ title: 'Resource' }} />
      <Stack.Screen name="office-print/[fileId]" options={{ ...sheet, title: 'Print to office' }} />
      <Stack.Screen name="settings/index" options={{ ...sheet, title: 'Menu' }} />
      <Stack.Screen name="settings/profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings/notifications" options={{ title: 'Notification settings' }} />
      <Stack.Screen name="notifications" options={{ ...sheet, title: 'Notifications' }} />
    </Stack>
  );
}
