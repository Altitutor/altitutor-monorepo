import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FullScreenLoading } from '@/components/tutor-ui';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemePreferenceProvider, useThemePreference } from '@/providers/theme-preference-provider';

export default function RootLayout() {
  const [queries] = useState(() => new QueryClient());
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queries}>
        <ThemePreferenceProvider>
          <AuthProvider>
            <Navigation />
          </AuthProvider>
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { status } = useAuth();
  const { resolvedScheme } = useThemePreference();
  const dark = resolvedScheme === 'dark';
  const loading = status === 'loading';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      {loading ? <FullScreenLoading label="Opening Tutor" /> : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={status === 'allowed'}>
            <Stack.Screen name="(authenticated)" />
          </Stack.Protected>
          <Stack.Protected guard={status !== 'allowed'}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      )}
      <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
