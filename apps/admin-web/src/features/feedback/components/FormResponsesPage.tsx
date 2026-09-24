'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from '@altitutor/ui';
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableState,
} from '@altitutor/shared';
import { format, endOfDay, startOfDay } from 'date-fns';
import { SettingsTableActions } from '@/shared/components/settings-table-actions';
import {
  FormResponseDialog,
  type FormResponseDetail,
  responsePersonLabel,
} from './FormResponseDialog';
import { DeleteFormResponseConfirmDialog } from './DeleteFormResponseConfirmDialog';

const INITIAL_STATE: DataTableState = {
  search: '',
  filters: {},
  sortBy: 'submitted_at',
  sortDirection: 'desc',
  groupBy: null,
  page: 1,
  pageSize: 50,
  visibleColumns: ['form', 'respondent_type', 'respondent', 'subject', 'recorded_by', 'session', 'submitted_at'],
};

function personKey(response: FormResponseDetail, kind: 'respondent' | 'subject') {
  const person =
    kind === 'respondent'
      ? response.respondent_student ?? response.respondent_staff ?? response.respondent_parent
      : response.subject_student ?? response.subject_staff ?? response.subject_parent;
  return person?.id ?? (kind === 'respondent' ? response.respondent_type : response.subject_type);
}

function dateInRange(value: string, from?: string, to?: string) {
  const time = new Date(value).getTime();
  if (from && time < startOfDay(new Date(from)).getTime()) return false;
  if (to && time > endOfDay(new Date(to)).getTime()) return false;
  return true;
}

export function FormResponsesPage() {
  const [rows, setRows] = useState<FormResponseDetail[]>([]);
  const [state, setState] = useState<DataTableState>(INITIAL_STATE);
  const [selectedResponse, setSelectedResponse] = useState<FormResponseDetail | null>(null);
  const [responseToDelete, setResponseToDelete] = useState<FormResponseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/forms/responses')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load responses');
        setRows(json.responses ?? []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => {
    const forms = new Map<string, string>();
    const respondentTypes = new Set<string>();
    const respondents = new Map<string, string>();
    const subjects = new Map<string, string>();

    for (const row of rows) {
      if (row.forms?.id) forms.set(row.forms.id, row.forms.name ?? row.forms.id);
      respondentTypes.add(row.respondent_type);
      respondents.set(personKey(row, 'respondent'), responsePersonLabel(row, 'respondent'));
      subjects.set(personKey(row, 'subject'), responsePersonLabel(row, 'subject'));
    }

    return [
      {
        key: 'form',
        label: 'Form',
        options: [...forms.entries()].map(([value, label]) => ({ value, label })),
        searchable: true,
      },
      {
        key: 'respondent_type',
        label: 'Respondent type',
        options: [...respondentTypes].map((value) => ({ value, label: value })),
      },
      {
        key: 'respondent',
        label: 'Respondent',
        options: [...respondents.entries()].map(([value, label]) => ({ value, label })),
        searchable: true,
      },
      {
        key: 'subject',
        label: 'Subject',
        options: [...subjects.entries()].map(([value, label]) => ({ value, label })),
        searchable: true,
      },
      {
        key: 'submitted',
        label: 'Submitted',
        type: 'date-range',
        fromKey: 'submitted_from',
        toKey: 'submitted_to',
      },
    ];
  }, [rows]);

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'form', label: 'Form', visibleByDefault: true },
    { key: 'version', label: 'Version', visibleByDefault: false },
    { key: 'respondent_type', label: 'Respondent type', visibleByDefault: true },
    { key: 'respondent', label: 'Respondent', visibleByDefault: true },
    { key: 'subject', label: 'Subject', visibleByDefault: true },
    { key: 'recorded_by', label: 'Recorded by', visibleByDefault: true },
    { key: 'session', label: 'Session', visibleByDefault: true },
    { key: 'submitted_at', label: 'Submitted', visibleByDefault: true },
  ];

  const processed = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    const filters = state.filters;
    let next = rows.filter((row) => {
      if (q) {
        const haystack = [
          row.forms?.name,
          row.forms?.purpose,
          row.respondent_type,
          row.subject_type,
          responsePersonLabel(row, 'respondent'),
          responsePersonLabel(row, 'subject'),
          row.recorded_by_staff ? `${row.recorded_by_staff.first_name ?? ''} ${row.recorded_by_staff.last_name ?? ''}` : '',
          row.sessions?.long_name,
          row.sessions?.short_name,
          row.id,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.form?.length && !filters.form.includes(row.forms?.id ?? '')) return false;
      if (filters.respondent_type?.length && !filters.respondent_type.includes(row.respondent_type)) return false;
      if (filters.respondent?.length && !filters.respondent.includes(personKey(row, 'respondent'))) return false;
      if (filters.subject?.length && !filters.subject.includes(personKey(row, 'subject'))) return false;
      const from = String(filters.submitted_from?.[0] ?? '');
      const to = String(filters.submitted_to?.[0] ?? '');
      if ((from || to) && !dateInRange(row.submitted_at, from || undefined, to || undefined)) return false;
      return true;
    });

    next = next.sort((a, b) => {
      const direction = state.sortDirection === 'asc' ? 1 : -1;
      if (state.sortBy === 'form') return direction * String(a.forms?.name ?? '').localeCompare(String(b.forms?.name ?? ''));
      return direction * (new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
    });
    return next;
  }, [rows, state.filters, state.search, state.sortBy, state.sortDirection]);

  const pageCount = Math.max(1, Math.ceil(processed.length / state.pageSize));
  const page = Math.min(state.page, pageCount);
  const paged = processed.slice((page - 1) * state.pageSize, page * state.pageSize);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <DataTableToolbar
        state={state}
        onSearchChange={(search) => setState((current) => ({ ...current, search, page: 1 }))}
        onFiltersChange={(filters) => setState((current) => ({ ...current, filters, page: 1 }))}
        onSortChange={(sortBy, sortDirection) => setState((current) => ({ ...current, sortBy, sortDirection, page: 1 }))}
        onGroupByChange={(groupBy) => setState((current) => ({ ...current, groupBy }))}
        onVisibleColumnsChange={(visibleColumns) => setState((current) => ({ ...current, visibleColumns }))}
        onQuickFilterApply={() => undefined}
        onReset={() => setState(INITIAL_STATE)}
        filterDefinitions={filterDefinitions}
        sortOptions={[{ key: 'submitted_at', label: 'Submitted date' }, { key: 'form', label: 'Form' }]}
        columnDefinitions={columnDefinitions}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Respondent type</TableHead>
              <TableHead>Respondent</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.forms?.name ?? 'Unknown form'}</TableCell>
                <TableCell>{row.form_versions?.version_number ?? '-'}</TableCell>
                <TableCell>{row.respondent_type}</TableCell>
                <TableCell>{responsePersonLabel(row, 'respondent')}</TableCell>
                <TableCell>{responsePersonLabel(row, 'subject')}</TableCell>
                <TableCell>{row.recorded_by_staff ? `${row.recorded_by_staff.first_name ?? ''} ${row.recorded_by_staff.last_name ?? ''}`.trim() : '-'}</TableCell>
                <TableCell>{row.sessions?.long_name ?? row.sessions?.short_name ?? (row.sessions?.start_at ? format(new Date(row.sessions.start_at), 'PP p') : '-')}</TableCell>
                <TableCell>{format(new Date(row.submitted_at), 'PP p')}</TableCell>
                <TableCell className="text-right">
                  <SettingsTableActions
                    actions={[
                      { id: 'view', label: 'View response', onSelect: () => setSelectedResponse(row) },
                      { id: 'delete', label: 'Delete response', destructive: true, onSelect: () => setResponseToDelete(row) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No form responses found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={state.pageSize}
        total={processed.length}
        onPageChange={(nextPage) => setState((current) => ({ ...current, page: nextPage }))}
        onPageSizeChange={(pageSize) => setState((current) => ({ ...current, pageSize, page: 1 }))}
      />
      <FormResponseDialog
        response={selectedResponse}
        onClose={() => setSelectedResponse(null)}
        onDeleted={(responseId) => setRows((current) => current.filter((row) => row.id !== responseId))}
      />
      <DeleteFormResponseConfirmDialog
        response={responseToDelete}
        open={Boolean(responseToDelete)}
        onOpenChange={(open) => { if (!open) setResponseToDelete(null); }}
        onDeleted={(responseId) => {
          setRows((current) => current.filter((row) => row.id !== responseId));
          setResponseToDelete(null);
        }}
      />
    </div>
  );
}
