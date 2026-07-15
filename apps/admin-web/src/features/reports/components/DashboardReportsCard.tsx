'use client';

import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useActiveStudentsCount } from '@/features/students/hooks/useStudentsQuery';
import {
  useActiveClassesCount,
  useCurrentEnrollmentsCount,
} from '@/features/classes/hooks/useClassesQuery';

const STAT_ROWS = [
  {
    key: 'students' as const,
    label: 'Active students',
    href: '/students',
  },
  {
    key: 'classes' as const,
    label: 'Active classes',
    href: '/classes',
  },
  {
    key: 'enrollments' as const,
    label: 'Students–classes',
    href: '/reports/scheduling',
  },
] as const;

function StatValue({
  value,
  isLoading,
  isError,
}: {
  value: number | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading && value === undefined) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (isError || value === undefined) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return <span className="text-sm font-semibold tabular-nums">{value.toLocaleString()}</span>;
}

export function DashboardReportsCard() {
  const students = useActiveStudentsCount();
  const classes = useActiveClassesCount();
  const enrollments = useCurrentEnrollmentsCount();

  const values = {
    students: students.data,
    classes: classes.data,
    enrollments: enrollments.data,
  };
  const loading = {
    students: students.isLoading,
    classes: classes.isLoading,
    enrollments: enrollments.isLoading,
  };
  const errors = {
    students: students.isError,
    classes: classes.isError,
    enrollments: enrollments.isError,
  };

  const isInitialLoading =
    (students.isLoading && students.data === undefined) ||
    (classes.isLoading && classes.data === undefined) ||
    (enrollments.isLoading && enrollments.data === undefined);

  return (
    <Card className="flex w-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Reports</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports/scheduling" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Reports
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isInitialLoading ? (
          <div className="flex items-center justify-center border-t py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y border-t">
            {STAT_ROWS.map(({ key, label, href }) => (
              <Link
                key={key}
                href={href}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50"
              >
                <span>{label}</span>
                <StatValue
                  value={values[key]}
                  isLoading={loading[key]}
                  isError={errors[key]}
                />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
