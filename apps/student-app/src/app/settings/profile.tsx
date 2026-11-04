import { Stack } from 'expo-router';
import { Linking, Pressable, Text } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { Card, ErrorBlock, KeyValueRow, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { openWebProfile } from '@/features/settings/open-web-profile';
import { useProfile } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

export default function ProfileScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const edit = () => {
    void openWebProfile().then((opened) => {
      if (opened) void profile.refetch();
    });
  };

  return (
    <>
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button accessibilityLabel="Edit profile" onPress={withHaptic(edit)}>
            Edit
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={withHaptic(edit)} style={{ padding: 12 }}>
                <Text style={{ color: theme.primary, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            ),
          }}
        />
      )}
      <StudentScreen title="My profile">
        {profile.isPending ? <LoadingBlock /> : null}
        {profile.isError ? <ErrorBlock message={profile.error.message} /> : null}
        {profile.data ? (
          <>
          <Card>
            <KeyValueRow label="Name"><Value align="right">{[profile.data.first_name, profile.data.last_name].filter(Boolean).join(' ') || 'Not provided'}</Value></KeyValueRow>
            <KeyValueRow label="Email"><Value align="right">{profile.data.email ?? 'Not provided'}</Value></KeyValueRow>
            <KeyValueRow label="Phone"><Value align="right">{profile.data.phone ?? 'Not provided'}</Value></KeyValueRow>
            <KeyValueRow label="School"><Value align="right">{profile.data.school ?? 'Not provided'}</Value></KeyValueRow>
            <KeyValueRow label="Year level"><Value align="right">{profile.data.year_level ? `Year ${profile.data.year_level}` : 'Not provided'}</Value></KeyValueRow>
            <KeyValueRow label="Curriculum"><Value align="right">{profile.data.curriculum ?? 'Not provided'}</Value></KeyValueRow>
          </Card>
          <NativeAction label="Privacy policy" secondary block onPress={() => void Linking.openURL('https://altitutor.com/mobile-privacy/')} />
          <NativeAction label="Request account deletion" secondary block onPress={() => void Linking.openURL('https://altitutor.com/mobile-account-deletion/')} />
          </>
        ) : null}
      </StudentScreen>
    </>
  );
}
