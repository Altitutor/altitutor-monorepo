'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import type { DataTableState } from '@altitutor/shared';
import { format } from 'date-fns';

const INITIAL_STATE: DataTableState = {
  search: '',
  filters: {},
  sortBy: 'submitted_at',
  sortDirection: 'desc',
  groupBy: null,
  page: 1,
  pageSize: 50,
  visibleColumns: ['form', 'respondent', 'subject', 'submitted_at'],
};

type ResponseRow = {
  id: string;
  respondent_type: string;
  subject_type: string;
  submitted_at: string;
  forms?: { name?: string | null; purpose?: string | null } | null;
  form_versions?: { version_number?: number | null } | null;
};

export function FormResponsesPage() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [state, setState] = useState<DataTableState>(INITIAL_STATE);
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

  const processed = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!q) return true;
      return [
        row.forms?.name,
        row.forms?.purpose,
        row.respondent_type,
        row.subject_type,
        row.id,
      ].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, state.search]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <DataTableToolbar
        state={state}
        onSearchChange={(search) => setState((current) => ({ ...current, search }))}
        onFiltersChange={(filters) => setState((current) => ({ ...current, filters }))}
        onSortChange={(sortBy, sortDirection) => setState((current) => ({ ...current, sortBy, sortDirection }))}
        onGroupByChange={(groupBy) => setState((current) => ({ ...current, groupBy }))}
        onVisibleColumnsChange={(visibleColumns) => setState((current) => ({ ...current, visibleColumns }))}
        onQuickFilterApply={() => undefined}
        onReset={() => setState(INITIAL_STATE)}
        filterDefinitions={[]}
        sortOptions={[{ key: 'submitted_at', label: 'Submitted date' }, { key: 'form', label: 'Form' }]}
        columnDefinitions={[]}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Respondent</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.forms?.name ?? 'Unknown form'}</TableCell>
                <TableCell>{row.form_versions?.version_number ?? '-'}</TableCell>
                <TableCell>{row.respondent_type}</TableCell>
                <TableCell>{row.subject_type}</TableCell>
                <TableCell>{format(new Date(row.submitted_at), 'PP p')}</TableCell>
              </TableRow>
            ))}
            {processed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No form responses found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
