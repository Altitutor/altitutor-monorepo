import { pastSessionTypes, readViewSettings, type PastSessionCursor, type PastSessionPerson, type QuickFilter } from '@altitutor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useDeferredValue, useState } from 'react';

import { Card, EmptyBlock, ErrorBlock, Label, LoadingBlock, SectionTitle, TappableRow } from '@/components/tutor-ui';
import { useAuth } from '@/providers/auth-provider';

import { findSessionPeople } from './api';
import { ChoicePills, ControlRow, OperationButton, OperationInput } from './operation-controls';
import { historyViewDefaults, listHistoryViews, listPastSessions, listPastSessionSubjects, removeHistoryView, saveHistoryView, type HistoryFilters } from './past-sessions-api';
import { operationsKey } from './queries';
import { sessionDate, sessionTime, sessionTypeLabel } from './session-model';

export const pastSessionsKey = [...operationsKey, 'past'] as const;
const viewKey = [...pastSessionsKey, 'views'] as const;
const categories = [
  { value: 'type', label: 'Session type' },
  { value: 'subject', label: 'Subject' },
  { value: 'student', label: 'Student' },
  { value: 'staff', label: 'Staff' },
] as const;
type Category = (typeof categories)[number]['value'];
const typeOptions = pastSessionTypes.map((value) => ({ value, label: sessionTypeLabel(value) }));
const filterKeys = [...categories.map(({ value }) => value), 'from', 'to'];

function savedFilters(view: QuickFilter, userId?: string): HistoryFilters {
  const { filters } = readViewSettings(view.config, historyViewDefaults, userId);
  return Object.fromEntries(filterKeys.flatMap((key) => {
    const values = (filters[key] ?? []).filter((value): value is string => typeof value === 'string');
    return values.length ? [[key, values]] : [];
  }));
}

function dayIsValid(value: string) {
  if (!value) return true;
  const day = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+day) && day.toISOString().slice(0, 10) === value;
}

function describePeople(people: PastSessionPerson[]) {
  const names = people.map(({ name }) => name).filter(Boolean);
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
}

type ViewEditor = { view?: QuickFilter; name: string } | { deleting: QuickFilter };

export function PastSessionsHistory() {
  const router = useRouter();
  const client = useQueryClient();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState<Category>('type');
  const [optionSearch, setOptionSearch] = useState('');
  const [selectedView, setSelectedView] = useState('all');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<ViewEditor | null>(null);
  const query = useDeferredValue(search.trim());
  const term = useDeferredValue(optionSearch.trim());
  const from = filters.from?.[0] ?? '';
  const to = filters.to?.[0] ?? '';
  const datesValid = dayIsValid(from) && dayIsValid(to) && (!from || !to || from <= to);

  const history = useInfiniteQuery({
    queryKey: [...pastSessionsKey, 'rows', filters, query],
    queryFn: ({ pageParam }) => listPastSessions(filters, query, pageParam, userId ?? ''),
    initialPageParam: null as PastSessionCursor | null,
    getNextPageParam: (page) => page.next ?? undefined,
    enabled: datesValid && Boolean(userId),
  });
  const views = useQuery({ queryKey: viewKey, queryFn: listHistoryViews });
  const options = useQuery({
    queryKey: [...pastSessionsKey, 'options', category, term],
    queryFn: () => category === 'subject'
      ? listPastSessionSubjects(term)
      : category === 'staff' || category === 'student'
        ? findSessionPeople(category, term)
        : Promise.resolve([]),
    enabled: filtersOpen && (category === 'subject' || ((category === 'staff' || category === 'student') && term.length >= 2)),
  });
  const changeView = useMutation({
    mutationFn: async (input: ViewEditor) => {
      if (!userId) throw new Error('Sign in to save a view.');
      if ('deleting' in input) {
        await removeHistoryView(input.deleting.id, userId);
        return null;
      }
      return saveHistoryView(input.name.trim(), filters, userId, input.view);
    },
    onSuccess: async (view) => {
      await client.invalidateQueries({ queryKey: viewKey });
      setEditor(null);
      setSelectedView(view?.id ?? 'all');
      if (!view) setFilters({});
    },
  });
  const allRows = history.data?.pages.flatMap(({ rows }) => rows) ?? [];
  const currentView = views.data?.find(({ id }) => id === selectedView);
  const ownView = currentView && currentView.user_id === userId ? currentView : undefined;
  const viewOptions = [{ value: 'all', label: 'All' }, ...(views.data ?? []).map(({ id, name }) => ({ value: id, label: name }))];
  const activeOptions = filters[category] ?? [];
  const categoryLabel = categories.find(({ value }) => value === category)?.label ?? '';
  const loadedPeople = category === 'staff' || category === 'student'
    ? allRows.flatMap((row) => category === 'staff' ? row.staff : row.students)
      .filter(({ name }) => !term || name.toLowerCase().includes(term.toLowerCase()))
    : [];
  const categoryOptions = category === 'type' ? typeOptions : [...new Map([
    ...activeOptions.map((id, index) => ({ value: id, label: labels[id] || `Selected ${category} ${index + 1}` })),
    ...[...(options.data ?? []), ...loadedPeople].map(({ id, name }) => ({ value: id, label: name })),
  ].map((option) => [option.value, option])).values()];
  const activeCount = Object.values(filters).reduce((count, values) => count + values.filter(Boolean).length, 0);

  function setValues(key: string, values: string[]) {
    setFilters((current) => {
      const next = { ...current };
      if (values.length && values.some(Boolean)) next[key] = values;
      else delete next[key];
      return next;
    });
  }

  function applyView(id: string) {
    const view = views.data?.find((item) => item.id === id);
    setSelectedView(id);
    setFilters(view ? savedFilters(view, profile?.id ?? undefined) : {});
  }

  function startEdit(next: ViewEditor) {
    changeView.reset();
    setEditor(next);
  }

  return (
    <>
      <SectionTitle>Past sessions</SectionTitle>
      <OperationInput accessibilityLabel="Search past sessions" placeholder="Search sessions"
        value={search} onChangeText={setSearch} maxLength={160} autoCorrect={false} />

      <Label>Saved views</Label>
      <ChoicePills label="Past sessions view" options={viewOptions} selected={[selectedView]} onSelect={applyView}
        disabled={changeView.isPending} />
      {views.isError ? <ErrorBlock message={views.error.message} /> : null}

      <ControlRow>
        <OperationButton label={filtersOpen ? 'Hide filters' : activeCount ? `Filters (${activeCount})` : 'Filters'}
          onPress={() => setFiltersOpen((open) => !open)} />
        {activeCount ? <OperationButton label="Clear filters" onPress={() => applyView('all')} disabled={changeView.isPending} /> : null}
        <OperationButton label="Save new view" onPress={() => startEdit({ name: '' })} disabled={!datesValid || changeView.isPending} />
        {ownView ? <OperationButton label="Update view" onPress={() => startEdit({ view: ownView, name: ownView.name })}
          disabled={!datesValid || changeView.isPending} /> : null}
        {ownView ? <OperationButton label="Delete view" onPress={() => startEdit({ deleting: ownView })} disabled={changeView.isPending} /> : null}
      </ControlRow>

      {editor ? (
        <Card>
          {'deleting' in editor ? <Label>Delete the saved view {editor.deleting.name}?</Label> : (
            <OperationInput accessibilityLabel="Saved view name" placeholder="View name" value={editor.name} maxLength={80}
              editable={!changeView.isPending} onChangeText={(name) => setEditor({ ...editor, name })} />
          )}
          {changeView.isError ? <ErrorBlock message={changeView.error.message} /> : null}
          <ControlRow>
            <OperationButton label="Cancel" onPress={() => setEditor(null)} disabled={changeView.isPending} />
            <OperationButton label={'deleting' in editor ? 'Confirm delete' : 'Save view'} prominent
              disabled={changeView.isPending || (!('deleting' in editor) && (!editor.name.trim() || !datesValid))}
              onPress={() => changeView.mutate(editor)} />
          </ControlRow>
        </Card>
      ) : null}

      {filtersOpen ? (
        <Card>
          <ChoicePills label="Filter by" options={categories} selected={[category]}
            onSelect={(next) => { setCategory(next); setOptionSearch(''); }} />
          {category !== 'type' ? (
            <OperationInput accessibilityLabel={`Search ${categoryLabel.toLowerCase()} options`} placeholder={`Search ${categoryLabel.toLowerCase()}`}
              value={optionSearch} onChangeText={setOptionSearch} maxLength={100} autoCorrect={false} />
          ) : null}
          {options.fetchStatus === 'fetching' ? <LoadingBlock label="Loading options…" /> : null}
          {options.isError ? <ErrorBlock message={options.error.message} /> : null}
          {categoryOptions.length ? (
            <ChoicePills label={categoryLabel} options={categoryOptions} selected={activeOptions} onSelect={(id) => {
              const option = categoryOptions.find((entry) => entry.value === id);
              if (option) setLabels((current) => ({ ...current, [id]: option.label }));
              setValues(category, activeOptions.includes(id) ? activeOptions.filter((value) => value !== id) : [...activeOptions, id]);
            }} />
          ) : <Label>{term.length < 2 ? 'Enter a name to see filter options.' : 'No matching options.'}</Label>}
          <OperationInput accessibilityLabel="From date" placeholder="From date (YYYY-MM-DD)" value={from} maxLength={10}
            onChangeText={(value) => setValues('from', [value])} />
          <OperationInput accessibilityLabel="To date" placeholder="To date (YYYY-MM-DD)" value={to} maxLength={10}
            onChangeText={(value) => setValues('to', [value])} />
        </Card>
      ) : null}

      {!datesValid ? <ErrorBlock message="Enter valid dates in YYYY-MM-DD order." /> : null}
      {datesValid && history.isPending ? <LoadingBlock label="Loading past sessions…" /> : null}
      {history.isError ? <ErrorBlock message={history.error.message} /> : null}
      {allRows.length ? (
        <Card divided>
          {allRows.map((row) => (
            <TappableRow key={row.id} title={row.subject} accent={row.subjectColor}
              detail={[
                `${sessionDate(row.startAt)} · ${sessionTime(row.startAt, row.endAt)}`,
                describePeople(row.staff), describePeople(row.students),
              ].filter(Boolean).join('\n')}
              onPress={() => router.push({ pathname: '/session/[sessionId]', params: { sessionId: row.id } })} />
          ))}
        </Card>
      ) : null}
      {history.isSuccess && !allRows.length ? <EmptyBlock>
        {history.hasNextPage ? 'No matches in the sessions searched so far.' : query || activeCount ? 'No sessions match your filters.' : 'No past sessions.'}
      </EmptyBlock> : null}
      {history.hasNextPage ? <OperationButton label={history.isFetchingNextPage ? 'Loading…' : 'Search older sessions'}
        disabled={history.isFetchingNextPage} onPress={() => void history.fetchNextPage()} /> : null}
    </>
  );
}
