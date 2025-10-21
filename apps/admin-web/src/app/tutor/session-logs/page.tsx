'use client';

import { useMemo } from 'react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useSessionsForStaff } from '@/features/sessions/hooks/useSessionsQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';

export default function TutorSessionLogsPage() {
  const { data: staff } = useCurrentStaff();
  const staffId = staff?.id || '';
  const { data: sessions = [], isLoading } = useSessionsForStaff(staffId);

  const rows = useMemo(() => sessions.map(s => ({
    id: s.id,
    date: s.date,
    type: s.type,
    status: s.status,
  })), [sessions]);

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
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">Loading sessions...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No sessions assigned</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.status}</TableCell>
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


