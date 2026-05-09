'use client';

import { useMemo } from 'react';
import { useSessions } from '@/features/sessions/hooks/useSessionsQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import type { Database } from '@altitutor/shared';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn, tutorTableBodyRow, tutorTableHeaderRow } from '@/shared/lib/tutor-visual';

type TutorSession = Database['public']['Views']['vtutor_sessions']['Row'];

interface SessionRow {
  id: string;
  date: string;
  subject_name: string | null;
}

export default function TutorSessionLogsPage() {
  const { data: sessionsData = [], isLoading } = useSessions();

  // Filter sessions for current tutor (sessions come from vtutor_sessions which is already filtered)
  const rows = useMemo(() => {
    if (!sessionsData) return [];
    return sessionsData.map((s: TutorSession): SessionRow => ({
      id: s.session_id || '',
      date: s.start_at ? s.start_at.split('T')[0] : (s.session_created_at ? s.session_created_at.split('T')[0] : ''),
      subject_name: s.subject_name || null,
    }));
  }, [sessionsData]);

  return (
    <TutorPageContainer className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My session logs</h1>
        <p className="mt-1 text-muted-foreground">Sessions assigned to you</p>
      </header>
      <Card className={tutorCardCn('overflow-hidden')}>
        <CardHeader>
          <CardTitle>Assigned sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell colSpan={2} className="h-24 text-center">
                    Loading sessions…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell colSpan={2} className="h-24 text-center">
                    No sessions assigned
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={tutorTableBodyRow}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.subject_name || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TutorPageContainer>
  );
}
