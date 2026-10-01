import { Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { Card, ErrorBlock, Label, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
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
          <Card>
            <Label>Name</Label>
            <Value>{[profile.data.first_name, profile.data.last_name].filter(Boolean).join(' ') || 'Not provided'}</Value>
            <Label>Email</Label>
            <Value>{profile.data.email ?? 'Not provided'}</Value>
            <Label>Phone</Label>
            <Value>{profile.data.phone ?? 'Not provided'}</Value>
            <Label>School</Label>
            <Value>{profile.data.school ?? 'Not provided'}</Value>
            <Label>Year level</Label>
            <Value>{profile.data.year_level ? `Year ${profile.data.year_level}` : 'Not provided'}</Value>
            <Label>Curriculum</Label>
            <Value>{profile.data.curriculum ?? 'Not provided'}</Value>
          </Card>
        ) : null}
      </StudentScreen>
    </>
  );
}
