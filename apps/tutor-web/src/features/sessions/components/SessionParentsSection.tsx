'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import { AttendanceCell } from './AttendanceCell';
import { tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual';
import type { ProcessedParent } from '../utils/sessionParents';

type SessionParentsSectionProps = {
  parentsData: ProcessedParent[];
};

export function SessionParentsSection({ parentsData }: SessionParentsSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Parents ({parentsData.length})</h3>
      </div>
      {parentsData.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">No parents linked</div>
      ) : (
        <div className={tutorTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Parent</TableHead>
                <TableHead>Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parentsData.map((row) => (
                <TableRow key={row.parent.id} className={tutorTableBodyRow}>
                  <TableCell className="font-medium">
                    {row.parent.first_name} {row.parent.last_name}
                  </TableCell>
                  <TableCell>
                    <AttendanceCell status={row.attendanceStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
