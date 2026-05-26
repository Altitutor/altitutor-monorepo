import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { Card, ErrorBlock, Label, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { useProfile, useUpdateProfile } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const update = useUpdateProfile(profile.data?.id ?? '');

  useEffect(() => {
    if (!profile.data) return;
    setFirstName(profile.data.first_name ?? '');
    setLastName(profile.data.last_name ?? '');
    setPhone(profile.data.phone ?? '');
  }, [profile.data]);

  function save() {
    update.mutate(
      { first_name: firstName, last_name: lastName, phone },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <>
      <Stack.Screen
        options={Platform.OS === 'android'
          ? {
              headerRight: () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={editing ? 'Cancel editing' : 'Edit profile'}
                  onPress={() => setEditing((value) => !value)}
                  style={styles.headerAction}>
                  <Text style={[styles.headerActionText, { color: theme.primary }]}>
                    {editing ? 'Cancel' : 'Edit'}
                  </Text>
                </Pressable>
              ),
            }
          : undefined}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={editing ? 'Cancel editing' : 'Edit profile'}
            icon={editing ? 'xmark' : 'pencil'}
            onPress={() => setEditing((value) => !value)}
          />
        </Stack.Toolbar>
      ) : null}
      <StudentScreen title="Profile" subtitle="Your student account details.">
        {profile.isPending ? <LoadingBlock /> : null}
        {profile.isError ? <ErrorBlock message={profile.error.message} /> : null}
        {profile.data ? (
          <Card>
            <Label>Name</Label>
            {editing ? (
              <>
                <TextInput placeholder="First name" value={firstName} onChangeText={setFirstName} style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]} />
                <TextInput placeholder="Last name" value={lastName} onChangeText={setLastName} style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]} />
              </>
            ) : <Value>{[profile.data.first_name, profile.data.last_name].filter(Boolean).join(' ') || 'Not provided'}</Value>}
            <Label>Email</Label>
            <Value>{profile.data.email ?? 'Not provided'}</Value>
            <Label>Phone</Label>
            {editing ? (
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]} />
            ) : <Value>{profile.data.phone ?? 'Not provided'}</Value>}
            <Label>School</Label>
            <Value>{profile.data.school ?? 'Not provided'}</Value>
            <Label>Year level</Label>
            <Value>{profile.data.year_level ? `Year ${profile.data.year_level}` : 'Not provided'}</Value>
            <Label>Curriculum</Label>
            <Value>{profile.data.curriculum ?? 'Not provided'}</Value>
            {update.isError ? <Text style={{ color: theme.danger }}>{update.error.message}</Text> : null}
            {editing ? <NativeAction label={update.isPending ? 'Saving...' : 'Save changes'} disabled={update.isPending} onPress={save} /> : null}
          </Card>
        ) : null}
      </StudentScreen>
    </>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 46, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  headerAction: { paddingHorizontal: 8, paddingVertical: 8 },
  headerActionText: { fontSize: 16, fontWeight: '600' },
});
