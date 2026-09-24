'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { DataTableFilterDefinition } from '@altitutor/shared';
import {
  AccountClassBadge,
  Badge,
  Button,
  ListToolbar,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { cn, formatSessionType, getSubjectColorStyle } from '@/shared/utils';
import {
  tutorBtnOutline,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
  tutorToolbarProps,
} from '@/shared/lib/tutor-visual';
import type { Tables } from '@altitutor/shared';
import { usePastSessionsWithDetails } from '../hooks/useSessionsQuery';
import {
  collectPastSessionStaffOptions,
  collectPastSessionStudentOptions,
  collectPastSessionSubjectOptions,
  collectPastSessionTypeValues,
  filterPastSessions,
  parsePastSessionFiltersFromToolbar,
  pastSessionsHaveActiveFilters,
} from '../utils/pastSessionsTable';
import { formatPersonDisplayName, formatTutorSessionSubjectLabel } from '../utils/sessionSubjectLabel';
import type { SessionStaff, SessionStudent } from '../utils/session-helpers';

const DEFAULT_PAGE_SIZE = 20;

export type PastSessionsTableProps = {
  onOpenSession: (sessionId: string) => void;
};

function subjectColorSubject(color: string | null): Tables<'subjects'> | null {
  if (!color) return null;
  return { color } as Tables<'subjects'>;
}

function StaffList({ staff }: { staff: SessionStaff[] }) {
  const visible = staff.filter((member) => member.id);
  if (visible.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((member) => {
        const name = formatPersonDisplayName(member) || 'Unknown';
        return (
          <span
            key={member.id}
            className={cn(member.planned_absence && 'text-muted-foreground line-through')}
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}

function StudentList({ students }: { students: SessionStudent[] }) {
  const visible = students.filter((student) => student.id);
  if (visible.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((student) => {
        const name = formatPersonDisplayName(student) || 'Student';
        return (
          <span
            key={student.id}
            className={cn(
              'flex items-center gap-2',
              student.planned_absence && 'text-muted-foreground line-through',
            )}
          >
            <span>{name}</span>
            <AccountClassBadge accountClass={student.account_class} />
          </span>
        );
      })}
    </div>
  );
}

export function PastSessionsTable({ onOpenSession }: PastSessionsTableProps) {
  const { data: sessions = [], isLoading, isError, refetch } = usePastSessionsWithDetails();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [filterSearchValues, setFilterSearchValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const parsedFilters = useMemo(() => parsePastSessionFiltersFromToolbar(filters), [filters]);

  const filtered = useMemo(
    () => filterPastSessions(sessions, search, parsedFilters),
    [sessions, search, parsedFilters],
  );

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => {
    const typeValues = collectPastSessionTypeValues(sessions);
    const subjectOptions = collectPastSessionSubjectOptions(sessions);
    const staffOptions = collectPastSessionStaffOptions(sessions);
    const studentOptions = collectPastSessionStudentOptions(sessions);

    const subjectQuery = (filterSearchValues.subject ?? '').trim().toLowerCase();
    const staffQuery = (filterSearchValues.staff ?? '').trim().toLowerCase();
    const studentQuery = (filterSearchValues.student ?? '').trim().toLowerCase();

    return [
      {
        key: 'type',
        label: 'Session Type',
        options: typeValues.map((value) => ({
          label: formatSessionType(value),
          value,
        })),
      },
      {
        key: 'subject',
        label: 'Subject',
        searchable: true,
        searchPlaceholder: 'Search subjects...',
        options: subjectOptions
          .filter((option) => !subjectQuery || option.label.toLowerCase().includes(subjectQuery))
          .map((option) => ({ label: option.label, value: option.id })),
      },
      {
        key: 'student',
        label: 'Student',
        searchable: true,
        searchPlaceholder: 'Search students...',
        options: studentOptions
          .filter((option) => !studentQuery || option.label.toLowerCase().includes(studentQuery))
          .map((option) => ({ label: option.label, value: option.id })),
      },
      {
        key: 'staff',
        label: 'Staff',
        searchable: true,
        searchPlaceholder: 'Search staff...',
        options: staffOptions
          .filter((option) => !staffQuery || option.label.toLowerCase().includes(staffQuery))
          .map((option) => ({ label: option.label, value: option.id })),
      },
      {
        key: 'date',
        label: 'Date',
        type: 'date-range',
        fromKey: 'from',
        toKey: 'to',
      },
    ];
  }, [sessions, filterSearchValues]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const hasActiveFilters = pastSessionsHaveActiveFilters(search, parsedFilters);

  if (isLoading) {
    return (
      <section aria-labelledby="past-sessions-heading" className="space-y-4">
        <h2 id="past-sessions-heading" className="text-2xl font-semibold">
          Past sessions
        </h2>
        <div className={tutorTableShell}>
          <SkeletonTable rows={8} columns={6} />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-labelledby="past-sessions-heading" className="space-y-4">
        <h2 id="past-sessions-heading" className="text-2xl font-semibold">
          Past sessions
        </h2>
        <p className="text-sm text-destructive">
          Could not load past sessions.{' '}
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="past-sessions-heading" className="space-y-4">
      <h2 id="past-sessions-heading" className="text-2xl font-semibold">
        Past sessions
      </h2>
      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search sessions"
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        filterDefinitions={filterDefinitions}
        filterSearchValues={filterSearchValues}
        onFilterSearchChange={(filterKey, value) => {
          setFilterSearchValues((prev) => ({ ...prev, [filterKey]: value }));
        }}
        {...tutorToolbarProps}
      />
      <div className="pt-3">
        <div className={tutorTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {hasActiveFilters
                      ? 'No sessions match your filters.'
                      : 'No past sessions found.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((session) => {
                  const start = session.start_at ? new Date(session.start_at) : null;
                  const end = session.end_at ? new Date(session.end_at) : null;
                  const subjectLabel = formatTutorSessionSubjectLabel(session);
                  const subjectForColor = subjectColorSubject(session.subject_color);
                  const { style, textColorClass } = getSubjectColorStyle(subjectForColor);
                  const defaultClass = !session.subject_color
                    ? 'bg-gray-100 text-gray-800 border-gray-300'
                    : '';
                  return (
                    <TableRow key={session.session_id} className={tutorTableBodyRow}>
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
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-normal',
                            defaultClass || textColorClass,
                            !defaultClass && 'border-0',
                          )}
                          style={style.backgroundColor ? style : undefined}
                        >
                          {subjectLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <StaffList staff={session.staff} />
                      </TableCell>
                      <TableCell>
                        <StudentList students={session.students} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={tutorBtnOutline}
                          onClick={() => onOpenSession(session.session_id)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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
    </section>
  );
}
