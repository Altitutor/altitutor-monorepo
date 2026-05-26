import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Card, StudentScreen, TappableRow } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function MoreScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signOut } = useAuth();

  return (
    <StudentScreen title="More" subtitle="Your account and application preferences.">
      <Card>
        <TappableRow title="Profile" detail="Personal details" onPress={() => router.push('/(tabs)/more/profile')} />
        <TappableRow title="Settings" detail="Appearance and notifications" onPress={() => router.push('/(tabs)/more/settings')} />
      </Card>
      <Card>
        <Text accessibilityRole="button" onPress={() => signOut()} style={[styles.signOut, { color: theme.danger }]}>
          Sign Out
        </Text>
      </Card>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  signOut: { paddingVertical: 5, fontSize: 16, textAlign: 'center', fontWeight: '600' },
});
