'use client';

import { useMemo } from 'react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useSessions } from '@/features/sessions/hooks/useSessionsQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';

export default function TutorSessionLogsPage() {
  const { data: staff } = useCurrentStaff();
  const { data: sessionsData = [], isLoading } = useSessions();

  // Filter sessions for current tutor (sessions come from vtutor_sessions which is already filtered)
  const rows = useMemo(() => {
    if (!sessionsData) return [];
    return sessionsData.map((s: any) => ({
      id: s.id,
      date: s.start_at ? s.start_at.split('T')[0] : (s.created_at ? s.created_at.split('T')[0] : ''),
      // Type might not be in vtutor_sessions - check the view structure
      type: s.type || 'SESSION',
    }));
  }, [sessionsData]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Session Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center h-24">Loading sessions...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center h-24">No sessions assigned</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.subject_name || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
