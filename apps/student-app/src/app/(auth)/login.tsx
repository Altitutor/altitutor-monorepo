import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NativeAction } from '@/components/native-action';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <Text style={[styles.brandName, { color: theme.primary }]}>Altitutor</Text>
          <Text style={[styles.title, { color: theme.text }]}>Student app</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to view classes, resources and billing.</Text>
        </View>
        <View style={[styles.form, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          <NativeAction label={busy ? 'Signing in...' : 'Sign in'} disabled={busy || !email || !password} onPress={submit} />
          <Link href="/(auth)/forgot-password" style={[styles.link, { color: theme.primary }]}>Forgot password?</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 22, gap: 28 },
  brand: { gap: 8 },
  brandName: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 38, fontWeight: '700' },
  subtitle: { fontSize: 16, lineHeight: 24 },
  form: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  link: { textAlign: 'center', paddingTop: 4, fontSize: 15, fontWeight: '500' },
});
