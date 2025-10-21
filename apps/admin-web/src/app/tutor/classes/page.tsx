'use client';

import { useMemo } from 'react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useClassesForStaffWithDetails } from '@/features/classes/hooks/useClassesQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import { formatTime } from '@/shared/utils/datetime';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TutorClassesPage() {
  const { data: staff } = useCurrentStaff();
  const staffId = staff?.id || '';
  const { data, isLoading } = useClassesForStaffWithDetails(staffId);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ id: string; subject: string; day: number; start: string | null; end: string | null; students: number; }>
    return (data.classes || []).map((cls) => ({
      id: cls.id,
      subject: cls.subject_id && data.classSubjects[cls.id] ? formatSubjectDisplay(data.classSubjects[cls.id]) : '-',
      day: cls.day_of_week || 0,
      start: cls.start_time || null,
      end: cls.end_time || null,
      students: (data.classStudents[cls.id] || []).length,
    }));
  }, [data]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Classes</h1>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Students</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Loading classes...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No classes assigned</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day] || '-'}</TableCell>
                      <TableCell>{formatTime(r.start || undefined)} - {formatTime(r.end || undefined)}</TableCell>
                      <TableCell>{r.subject}</TableCell>
                      <TableCell>{r.students}</TableCell>
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


