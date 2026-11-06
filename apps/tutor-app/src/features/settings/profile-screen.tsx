import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { Card, ErrorBlock, KeyValueRow, Label, SectionTitle, TutorScreen, Value } from '@/components/tutor-ui';
import { useTheme } from '@/hooks/use-theme';
import { tutorWebJson } from '@/lib/tutor-web';
import { useAuth } from '@/providers/auth-provider';

const availability = [
  ['availability_monday', 'Monday'],
  ['availability_tuesday', 'Tuesday'],
  ['availability_wednesday', 'Wednesday'],
  ['availability_thursday', 'Thursday'],
  ['availability_friday', 'Friday'],
  ['availability_saturday_am', 'Saturday morning'],
  ['availability_saturday_pm', 'Saturday afternoon'],
  ['availability_sunday_am', 'Sunday morning'],
  ['availability_sunday_pm', 'Sunday afternoon'],
] as const;
type AvailabilityField = typeof availability[number][0];
type ProfileDraft = Partial<Record<AvailabilityField, boolean> & {
  phone_number: string;
  profile_bio: string;
}>;

export default function ProfileScreen() {
  const { profile, session } = useAuth();
  const theme = useTheme();
  const queries = useQueryClient();
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: (values: ProfileDraft) => tutorWebJson('/api/profile', 'PATCH', values, session?.user.id),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['tutor-profile', session?.user.id] });
      setDraft({});
      setSaved(true);
    },
  });
  const inputStyle = {
    minHeight: 46, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    backgroundColor: theme.background, color: theme.text,
  };
  const disabled = !Object.keys(draft).length || update.isPending;
  const updateField = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => {
    setSaved(false);
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <TutorScreen title="Profile" largeTitle={false}>
      <Card>
        <KeyValueRow label="Name"><Value>{[profile?.first_name, profile?.last_name].filter(Boolean).join(' ')}</Value></KeyValueRow>
        <KeyValueRow label="Email"><Value>{profile?.email ?? session?.user.email}</Value></KeyValueRow>
      </Card>
      <SectionTitle>Contact and bio</SectionTitle>
      <Card>
        <Label>Phone number</Label>
        <TextInput accessibilityLabel="Phone number" autoComplete="tel" keyboardType="phone-pad"
          editable={!update.isPending} value={draft.phone_number ?? profile?.phone ?? ''}
          onChangeText={(value) => updateField('phone_number', value)} style={inputStyle} />
        <Label>Profile bio</Label>
        <TextInput accessibilityLabel="Profile bio" editable={!update.isPending} multiline maxLength={1200}
          value={draft.profile_bio ?? profile?.profile_bio ?? ''}
          onChangeText={(value) => updateField('profile_bio', value)}
          style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} />
      </Card>
      <SectionTitle>Availability</SectionTitle>
      <Card divided>
        {availability.map(([key, label]) => (
          <View key={key} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: theme.text, flex: 1, fontSize: 16 }}>{label}</Text>
            <Switch accessibilityLabel={label} disabled={update.isPending}
              value={draft[key] ?? Boolean(profile?.[key])}
              onValueChange={(value) => updateField(key, value)} />
          </View>
        ))}
      </Card>
      {update.error ? <ErrorBlock message={update.error.message} /> : null}
      {saved ? <Text accessibilityLiveRegion="polite" style={{ color: theme.success }}>Profile saved.</Text> : null}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => update.mutate(draft)}
        style={({ pressed }) => ({
          minHeight: 48, backgroundColor: theme.primary, borderRadius: 14, alignItems: 'center',
          justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        })}>
        <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>{update.isPending ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
    </TutorScreen>
  );
}
