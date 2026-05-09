'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@altitutor/ui';
import { FileText } from 'lucide-react';
import { useUnloggedSessions } from '../hooks';
import {
  tutorBtnPrimary,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from '@/shared/lib/tutor-visual';

const DEFAULT_PAGE_SIZE = 10;

export type UnloggedSessionsTableSectionProps = {
  staffId: string;
  onLogSession: (sessionId: string) => void;
};

function subjectAndClassLabel(session: {
  class?: {
    level?: string | null;
    subject?: {
      curriculum?: string | null;
      year_level?: number | null;
      name?: string | null;
    };
  } | null;
}): string {
  const subject = session.class?.subject;
  const parts: string[] = [];
  if (subject?.curriculum) parts.push(String(subject.curriculum));
  if (subject?.year_level != null) parts.push(`Year ${subject.year_level}`);
  if (subject?.name) parts.push(subject.name);
  if (session.class?.level) parts.push(session.class.level);
  return parts.length > 0 ? parts.join(' ') : '—';
}

export function UnloggedSessionsTableSection({
  staffId,
  onLogSession,
}: UnloggedSessionsTableSectionProps) {
  const { data: sessions, isLoading, isError } = useUnloggedSessions(staffId);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const sorted = useMemo(() => {
    if (!sessions?.length) return [];
    return [...sessions].sort(
      (a, b) =>
        new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime(),
    );
  }, [sessions]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  if (!isLoading && !isError && sorted.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="unlogged-sessions-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="unlogged-sessions-heading" className="text-2xl font-semibold">
          Unlogged sessions
        </h2>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">
          Could not load unlogged sessions. Refresh the page or try again later.
        </p>
      ) : isLoading ? (
        <div className={tutorTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="w-[140px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i} className={tutorTableBodyRow}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-9 w-28 rounded-xl" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className={tutorTableShell}>
            <Table>
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className={tutorTableHeaderRow}>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="w-[140px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((session) => {
                  const sessionId = session.id;
                  const start = session.start_at ? new Date(session.start_at) : null;
                  const end = session.end_at ? new Date(session.end_at) : null;
                  return (
                    <TableRow key={sessionId} className={tutorTableBodyRow}>
                      <TableCell className="tabular-nums">
                        {start ? format(start, 'EEE, d MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {start && end
                          ? `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
                          : start
                            ? format(start, 'HH:mm')
                            : '—'}
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={subjectAndClassLabel(session)}>
                        {subjectAndClassLabel(session)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          className={tutorBtnPrimary}
                          onClick={() => onLogSession(sessionId)}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          Log session
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            className="pt-2"
          />
        </>
      )}
    </section>
  );
}
