import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NativeAction } from '@/components/native-action';
import { signInWithBrowser } from '@/features/auth/browser-auth';
import { useTheme } from '@/hooks/use-theme';
import { authConfigured, studentWebUrl } from '@/lib/student-web';

export default function LandingScreen() {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const [busy, setBusy] = useState<'login' | 'signup' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy('login');
    setError(null);
    try {
      await signInWithBrowser();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function openTrialBooking() {
    setBusy('signup');
    setError(null);
    try {
      await openBrowserAsync(studentWebUrl('/booking/trial-session'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open sign up. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingBottom: compact ? 16 : 28 }]}>
        <Text style={[styles.brand, { color: theme.primary }]}>ALTITUTOR</Text>
        <View style={styles.hero}>
          <Image
            accessibilityLabel="Altitutor"
            source={require('../../../assets/images/icon.png')}
            contentFit="cover"
            style={compact ? styles.iconCompact : styles.icon}
          />
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }, compact ? styles.titleCompact : styles.titleRegular]}>
            Welcome to Altitutor
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Classes, resources, and billing for your tutoring.
          </Text>
        </View>
        <View style={styles.actions}>
          {!authConfigured || error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
              {error ?? 'Sign-in is not configured for this build.'}
            </Text>
          ) : null}
          <NativeAction
            label={busy === 'login' ? 'Signing in...' : 'Sign in'}
            block
            color={theme.accent}
            labelColor={theme.text}
            disabled={Boolean(busy) || !authConfigured}
            onPress={() => void signIn()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not a student? Sign up"
            disabled={Boolean(busy) || !authConfigured}
            onPress={() => void openTrialBooking()}
            style={styles.signup}>
            <Text style={[styles.signupText, { color: theme.textSecondary }]}>
              Not a student?{' '}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>
                {busy === 'signup' ? 'Opening...' : 'Sign up'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 12, gap: 24 },
  brand: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  hero: { flex: 1, justifyContent: 'center', gap: 16 },
  icon: { width: 120, height: 120, borderRadius: 28, borderCurve: 'continuous' },
  iconCompact: { width: 96, height: 96, borderRadius: 22, borderCurve: 'continuous' },
  title: { fontWeight: '700', letterSpacing: -0.8 },
  titleRegular: { fontSize: 42, lineHeight: 48 },
  titleCompact: { fontSize: 34, lineHeight: 40 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  actions: { gap: 14 },
  error: { fontSize: 15, lineHeight: 22 },
  signup: { alignItems: 'center', paddingVertical: 8 },
  signupText: { fontSize: 16, lineHeight: 22 },
});
