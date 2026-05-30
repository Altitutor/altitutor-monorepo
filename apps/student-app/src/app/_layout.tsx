import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/providers/auth-provider';
import { ThemePreferenceProvider, useThemePreference } from '@/providers/theme-preference-provider';
import { useNotificationNavigation } from '@/lib/notifications';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  useNotificationNavigation();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
          <AuthProvider>
            <AppNavigation />
          </AuthProvider>
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigation() {
  const { resolvedScheme } = useThemePreference();
  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="session/[sessionId]"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.9], sheetInitialDetentIndex: 0, sheetGrabberVisible: true }}
        />
        <Stack.Screen name="billing-management" options={{ presentation: 'formSheet', title: 'Manage billing' }} />
        <Stack.Screen name="invoice-viewer" options={{ presentation: 'formSheet', title: 'Invoice' }} />
      </Stack>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
