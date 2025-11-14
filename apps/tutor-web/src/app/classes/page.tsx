'use client';

import { useMemo } from 'react';
import { useClasses } from '@/features/classes/hooks/useClassesQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import { formatTime } from '@/shared/utils/datetime';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TutorClassesPage() {
  const { data: classesData, isLoading } = useClasses();

  const rows = useMemo(() => {
    if (!classesData) return [];
    return classesData.map((cls: any) => ({
      id: cls.id,
      subject: cls.subject_name ? formatSubjectDisplay({
        name: cls.subject_name,
        curriculum: cls.subject_curriculum,
        discipline: cls.subject_discipline,
        level: cls.subject_level,
        year_level: cls.subject_year_level,
      } as any) : '-',
      day: cls.day_of_week || 0,
      start: cls.start_time || null,
      end: cls.end_time || null,
      // Students count not available in vtutor_classes - would need to fetch detail view
      students: 0,
    }));
  }, [classesData]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Classes</h1>
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Room</TableHead>
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
                  rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day] || '-'}</TableCell>
                      <TableCell>{formatTime(r.start || undefined)} - {formatTime(r.end || undefined)}</TableCell>
                      <TableCell>{r.subject}</TableCell>
                      <TableCell>{r.room || '-'}</TableCell>
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
