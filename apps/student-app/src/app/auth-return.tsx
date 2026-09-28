import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { FullScreenLoading } from '@/components/student-ui';
import { completeBrowserAuth } from '@/features/auth/browser-auth';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function AuthReturnScreen() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const theme = useTheme();
  const { session, loading } = useAuth();
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let mounted = true;
    void completeBrowserAuth(url)
      .then(() => {
        if (mounted) setCompleted(true);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Unable to finish signing in.');
      });
    return () => {
      mounted = false;
    };
  }, [url]);

  useEffect(() => {
    if (completed && !loading && session) router.replace('/(tabs)/dashboard');
  }, [completed, loading, session, router]);

  const failure = error ?? (!url ? 'No sign-in link was received. Please sign in again.' : null);
  if (!failure) return <FullScreenLoading label="Signing you in..." />;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
        {failure}
      </Text>
      <NativeAction label="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  error: { fontSize: 16, lineHeight: 22 },
});
