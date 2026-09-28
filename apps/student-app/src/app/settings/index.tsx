import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text } from 'react-native';

import { Card, StudentScreen, TappableRow } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signOut } = useAuth();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Your classes and resources stay with your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          haptic('warning');
          void signOut().catch((error: unknown) => {
            Alert.alert('Unable to sign out', error instanceof Error ? error.message : 'Please try again.');
          });
        },
      },
    ]);
  }

  return (
    <StudentScreen title="Menu">
      <Card>
        <TappableRow title="App settings" detail="Appearance and notifications" onPress={() => router.push('/settings/app-settings')} />
        <TappableRow title="My profile" detail="Personal details" onPress={() => router.push('/settings/profile')} />
      </Card>
      <Card>
        <Text accessibilityRole="button" onPress={confirmSignOut} style={[styles.signOut, { color: theme.danger }]}>
          Sign out
        </Text>
      </Card>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  signOut: { paddingVertical: 5, fontSize: 16, textAlign: 'center', fontWeight: '600' },
});
