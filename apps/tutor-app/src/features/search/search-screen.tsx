import { searchTutorEntities } from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, TappableRow, TutorScreen } from '@/components/tutor-ui';
import { useResourceSubjects } from '@/features/resources/use-resource-subjects';
import {
  getEffectiveSearchScopes,
  groupSearchResults,
  searchScopes,
  toggleSearchScope,
  type SearchScope,
} from '@/features/search/search-model';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { tutorWebUrl } from '@/lib/tutor-web';

const placeholder = 'Search or try 12CHEM 2.2';

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<SearchScope[]>([]);
  const [openError, setOpenError] = useState<string>();
  const trimmed = search.trim();
  const scopes = getEffectiveSearchScopes(selected, trimmed);
  const entityTypes = scopes.filter((scope) => scope !== 'pages');
  const includePages = scopes.includes('pages');
  const subjects = useResourceSubjects(includePages);
  const shouldSearch = entityTypes.length > 0 && trimmed.length >= 2;
  const ready = debounced === trimmed;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 250);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const query = useQuery({
    queryKey: ['tutor-command-search', debounced, entityTypes],
    queryFn: () => searchTutorEntities(supabase, debounced, entityTypes),
    enabled: shouldSearch && ready,
    staleTime: 30_000,
  });
  const groups = groupSearchResults(scopes, trimmed, ready ? query.data ?? [] : [], subjects.data);
  const pending = (shouldSearch && (!ready || query.isPending)) || (includePages && subjects.isPending);
  const all = Object.keys(searchScopes).length;
  const allSelected = !selected.length || selected.length === all;

  return (
    <>
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Screen options={{
          headerSearchBarOptions: {
            placement: 'automatic',
            placeholder,
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }} />
      ) : null}
      <TutorScreen title="Search">
        {process.env.EXPO_OS !== 'ios' ? (
          <TextInput
            accessibilityLabel="Search tutor portal"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            style={{
              minHeight: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              fontSize: 16,
              color: theme.text,
              backgroundColor: theme.backgroundElement,
            }}
          />
        ) : null}
        <View accessibilityLabel="Search in" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ScopeButton label="All" selected={allSelected} onPress={() => setSelected(toggleSearchScope(selected))} />
          {Object.entries(searchScopes).map(([key, label]) => {
            const scope = key as SearchScope;
            return <ScopeButton
              key={scope}
              label={label}
              selected={!allSelected && selected.includes(scope)}
              onPress={() => setSelected((current) => toggleSearchScope(current, scope))}
            />;
          })}
        </View>
        {pending ? <LoadingBlock label="Searching…" /> : null}
        {ready && query.isError ? <ErrorBlock message={query.error instanceof Error ? query.error.message : 'Could not search tutor resources.'} /> : null}
        {includePages && subjects.isError ? <ErrorBlock message={subjects.error.message} /> : null}
        {openError ? <ErrorBlock message={openError} /> : null}
        {groups.length === 0 && !pending && !query.isError ? (
          <EmptyBlock>{trimmed.length >= 2 ? 'No results found.' : 'Enter at least two characters to search resources.'}</EmptyBlock>
        ) : null}
        {groups.map(({ scope, items }) => (
          <View key={scope} style={{ gap: 8 }}>
            <SectionTitle>{searchScopes[scope]}</SectionTitle>
            <Card divided>
              {items.map(({ id, title, detail, destination }) => (
                <TappableRow
                  key={id}
                  title={title}
                  detail={destination.webPath ? [detail, 'Opens Tutor Web'].filter(Boolean).join(' · ') : detail}
                  onPress={() => {
                    Keyboard.dismiss();
                    setOpenError(undefined);
                    if (destination.href) {
                      router.navigate(destination.href);
                      return;
                    }
                    const webPath = destination.webPath;
                    if (!webPath) return;
                    void Promise.resolve().then(() => Linking.openURL(tutorWebUrl(webPath))).catch(() => {
                      setOpenError('Could not open Tutor Web.');
                    });
                  }}
                />
              ))}
            </Card>
          </View>
        ))}
      </TutorScreen>
    </>
  );
}

function ScopeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search in ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ color: selected ? theme.primary : theme.textSecondary, fontSize: 14, fontWeight: selected ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}
