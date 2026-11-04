import { Text, View } from 'react-native';

import { KeyValueRow, Value } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

type SessionPerson = { id?: string; first_name?: string; last_name?: string; name?: string };

export function readSessionPeople(value: unknown): SessionPerson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((person) => {
    if (!person || typeof person !== 'object') return [];
    return [person as SessionPerson];
  });
}

function personName(person: SessionPerson) {
  return person.name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed';
}

export function SessionPeopleRow({ label, people, currentStudentId }: { label: string; people: SessionPerson[]; currentStudentId: string | null }) {
  const theme = useTheme();
  return (
    <KeyValueRow label={label}>
      {people.length === 0 ? <Value align="right">Not listed</Value> : people.map((person) => (
        <View key={person.id ?? personName(person)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '500', textAlign: 'right' }}>{personName(person)}</Text>
          {currentStudentId && person.id === currentStudentId ? (
            <View style={{ backgroundColor: theme.backgroundSelected, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>You</Text>
            </View>
          ) : null}
        </View>
      ))}
    </KeyValueRow>
  );
}
