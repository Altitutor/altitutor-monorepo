import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { configured, supabase } from '@/lib/supabase';
import { tutorWebUrl } from '@/lib/tutor-web';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const theme = useTheme();
  const { status, retry, signOut, signOutBusy, signOutError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaving = status === 'sign-out-pending';
  const blocked = status === 'denied' || status === 'unavailable' || leaving;
  const canSignIn = configured && Boolean(email.trim() && password) && !busy;
  const inputStyle = {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, minHeight: 48,
    backgroundColor: theme.backgroundElement, color: theme.text, fontSize: 17,
  };

  async function submit() {
    if (!canSignIn) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 440, gap: 16 }}>
          <Image source={require('../../assets/images/icon.png')} accessibilityLabel="Altitutor"
            style={{ width: 76, height: 76, borderRadius: 18 }} />
          <Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: '700', color: theme.text }}>Altitutor Tutor</Text>
          <Text style={{ fontSize: 16, color: theme.textSecondary }}>
            {leaving ? 'Tutor is locked while sign-out is pending.'
              : status === 'denied' ? 'This account does not have access to the tutor portal.'
              : status === 'unavailable' ? 'We could not check your tutor access. Try again.'
                : 'Sign in with your tutor account.'}
          </Text>
          {!blocked ? (
            <>
              <TextInput accessibilityLabel="Email" placeholder="Email" placeholderTextColor={theme.textSecondary}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                autoComplete="email" value={email} onChangeText={setEmail} style={inputStyle} />
              <TextInput accessibilityLabel="Password" placeholder="Password" placeholderTextColor={theme.textSecondary}
                secureTextEntry autoComplete="current-password" value={password}
                onChangeText={setPassword} onSubmitEditing={() => void submit()} style={inputStyle} />
              <Pressable accessibilityRole="button" disabled={!canSignIn} onPress={() => void submit()}
                style={({ pressed }) => ({
                  backgroundColor: theme.primary, padding: 14, borderRadius: 14, alignItems: 'center',
                  opacity: !canSignIn ? 0.5 : pressed ? 0.7 : 1,
                })}>
                <Text style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 16 }}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="link" disabled={!configured} onPress={() => {
                void openBrowserAsync(tutorWebUrl('/forgot-password')).catch(() => setError('Unable to open password recovery.'));
              }} style={{ paddingVertical: 12 }}>
                <Text style={{ color: theme.primary }}>Forgot password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              {status === 'unavailable' ? (
                <Pressable accessibilityRole="button" onPress={retry} style={{ paddingVertical: 12 }}>
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>Retry</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" disabled={signOutBusy}
                onPress={() => { setError(null); void signOut(); }} style={{ paddingVertical: 12 }}>
                <Text style={{ color: theme.primary }}>
                  {signOutBusy ? 'Signing out…' : leaving ? 'Finish signing out' : 'Use a different account'}
                </Text>
              </Pressable>
            </>
          )}
          {signOutError || error || !configured ? (
            <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>
              {signOutError ?? error ?? 'Sign-in is not configured for this build.'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
