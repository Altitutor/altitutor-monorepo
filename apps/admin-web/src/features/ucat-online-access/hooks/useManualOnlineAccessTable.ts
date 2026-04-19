'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import type { DataTableState } from '@altitutor/shared';
import { manualOnlineAccessApi, type ManualOnlineAccessRow } from '../api/ucat-online-access';

function matchesSearch(row: ManualOnlineAccessRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const st = row.student;
  const fullName = `${st?.first_name ?? ''} ${st?.last_name ?? ''}`.trim().toLowerCase();
  const sub = row.subject?.name?.toLowerCase() ?? '';
  const notes = (row.notes ?? '').toLowerCase();
  return fullName.includes(s) || sub.includes(s) || notes.includes(s);
}

export function useManualOnlineAccessTable(state: DataTableState) {
  const query = useQuery({
    queryKey: ['manual-online-access', 'list'],
    queryFn: () => manualOnlineAccessApi.list(),
  });

  const { rows, total } = useMemo(() => {
    const allRows = query.data ?? [];
    let list = [...allRows];
    const studentIds = (state.filters.student as string[] | undefined) ?? [];
    const subjectIds = (state.filters.subject as string[] | undefined) ?? [];
    const from = String((state.filters.from as string[] | undefined)?.[0] ?? '');
    const to = String((state.filters.to as string[] | undefined)?.[0] ?? '');

    if (studentIds.length > 0) {
      list = list.filter((r) => r.student_id && studentIds.includes(r.student_id));
    }
    if (subjectIds.length > 0) {
      list = list.filter((r) => subjectIds.includes(r.subject_id));
    }
    if (from || to) {
      list = list.filter((r) => {
        const rowDate = format(parseISO(r.created_at), 'yyyy-MM-dd');
        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
        return true;
      });
    }
    if (state.search.trim()) {
      list = list.filter((r) => matchesSearch(r, state.search));
    }

    const sortBy = state.sortBy ?? 'created_at';
    const dir = state.sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortBy === 'student_name') {
        const an = `${a.student?.last_name ?? ''} ${a.student?.first_name ?? ''}`.toLowerCase();
        const bn = `${b.student?.last_name ?? ''} ${b.student?.first_name ?? ''}`.toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      if (sortBy === 'subject_name') {
        const an = (a.subject?.name ?? '').toLowerCase();
        const bn = (b.subject?.name ?? '').toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      return 0;
    });

    const totalCount = list.length;
    const start = (state.page - 1) * state.pageSize;
    const paginated = list.slice(start, start + state.pageSize);
    return { rows: paginated, total: totalCount };
  }, [query.data, state]);

  return {
    rows,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
