import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { Card, StudentScreen, TappableRow } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { openStudentWebPage } from '@/features/settings/open-web-profile';
import { haptic, withHaptic } from '@/lib/haptics';
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
      <Card divided>
        <TappableRow title="App settings" onPress={withHaptic(() => router.push('/settings/app-settings'))} />
        <TappableRow title="My profile" onPress={withHaptic(() => router.push('/settings/profile'))} />
        <TappableRow title="Manage flashcards" onPress={withHaptic(() => router.push('/flashcards/manage'))} />
        <TappableRow title="Flashcard settings" onPress={withHaptic(() => { void openStudentWebPage('/settings/flashcards'); })} />
      </Card>
      <NativeAction label="Sign out" secondary block color={theme.danger} labelColor={theme.danger} onPress={confirmSignOut} />
    </StudentScreen>
  );
}
