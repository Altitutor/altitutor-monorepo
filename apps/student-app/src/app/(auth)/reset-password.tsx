import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { StudentScreen } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (complete) return <Redirect href="/(tabs)/dashboard" />;

  async function submit() {
    if (password.length < 8 || password !== confirmation) {
      setMessage('Passwords must match and contain at least 8 characters.');
      return;
    }
    try {
      await updatePassword(password);
      setComplete(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to update password.');
    }
  }

  return (
    <StudentScreen title="Choose password" subtitle={session ? 'Set a new password for your account.' : 'Open this screen from the reset email link.'}>
      <TextInput
        secureTextEntry
        placeholder="New password"
        placeholderTextColor={theme.textSecondary}
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
      <TextInput
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={theme.textSecondary}
        value={confirmation}
        onChangeText={setConfirmation}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
      {message ? <Text style={{ color: theme.danger }}>{message}</Text> : null}
      <NativeAction label="Update password" disabled={!session} onPress={submit} />
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
