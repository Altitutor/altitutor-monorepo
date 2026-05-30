import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { StudentScreen } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    try {
      await requestPasswordReset(email.trim());
      setMessage('Check your email for a password reset link.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to send reset email.');
    }
  }

  return (
    <StudentScreen title="Reset password" subtitle="We will send a secure reset link to your email.">
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
      {message ? <Text style={{ color: theme.text }}>{message}</Text> : null}
      <NativeAction label="Send reset link" disabled={!email} onPress={submit} />
      <Link href="/(auth)/login" style={{ color: theme.primary }}>Back to sign in</Link>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
