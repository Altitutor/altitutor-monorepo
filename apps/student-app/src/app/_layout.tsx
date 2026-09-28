import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ResourceNavigationProvider } from '@/features/resources/resource-navigation';
import { useTheme } from '@/hooks/use-theme';
import { useNotificationNavigation } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemePreferenceProvider, useThemePreference } from '@/providers/theme-preference-provider';

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.5, 1],
  sheetGrabberVisible: true,
  headerShown: true,
  headerLargeTitleEnabled: false,
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  useNotificationNavigation();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
          <AuthProvider>
            <ResourceNavigationProvider>
              <AppNavigation />
            </ResourceNavigationProvider>
          </AuthProvider>
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigation() {
  const { resolvedScheme } = useThemePreference();
  const theme = useTheme();
  useReturnToLogin();
  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerTintColor: theme.primary,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth-return" options={{ headerShown: false, title: 'Signing in' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="session/[sessionId]"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.9], sheetInitialDetentIndex: 0, sheetGrabberVisible: true }}
        />
        <Stack.Screen name="billing-management" options={{ presentation: 'formSheet', title: 'Manage billing' }} />
        <Stack.Screen name="invoice-viewer" options={{ presentation: 'formSheet', title: 'Invoice' }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
        <Stack.Screen name="notifications" options={{ ...sheet, title: 'Notifications' }} />
        <Stack.Screen name="resource-topic/[topicId]" options={{ headerShown: true, title: 'Topic', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="flashcard-topic/[topicId]" options={{ headerShown: true, title: 'Topic flashcards', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="resource-file/[fileId]" options={{ headerShown: true, title: 'Resource', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="topic-navigator" options={{ ...sheet, title: 'Topics' }} />
        <Stack.Screen name="file-navigator" options={{ ...sheet, title: 'Files' }} />
      </Stack>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

function useReturnToLogin() {
  const { loading, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading || session) return;
    const root = segments[0];
    if (!root || root === '(auth)' || root === 'auth-return') return;
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(auth)/login');
  }, [loading, router, segments, session]);
}
