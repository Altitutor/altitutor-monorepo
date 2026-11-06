import { useRouter } from 'expo-router';

import { Card, TappableRow, TutorScreen } from '@/components/tutor-ui';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference, type ThemePreference } from '@/providers/theme-preference-provider';

const themes: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { preference, setPreference } = useThemePreference();

  return (
    <TutorScreen title="Menu" largeTitle={false}>
      <Card divided>
        <TappableRow title="Profile" detail={[profile?.first_name, profile?.last_name].filter(Boolean).join(' ')}
          onPress={() => router.push('/settings/profile')} />
        <TappableRow title="Notification settings" onPress={() => router.push('/settings/notifications')} />
      </Card>
      <Card divided>
        {themes.map(({ label, value }) => (
          <TappableRow key={value} title={label} detail={value === preference ? 'Current appearance' : undefined}
            onPress={() => setPreference(value)} />
        ))}
      </Card>
      <Card divided>
        <TappableRow title="Sign out" onPress={() => void signOut()} />
      </Card>
    </TutorScreen>
  );
}
