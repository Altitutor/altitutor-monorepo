'use client';

import type { Tables } from '@altitutor/shared';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { cn } from '@/shared/utils/index';
import { getShortSessionName } from '@/features/sessions/utils/session-helpers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { useUnloggedSessionsForStaff } from '../../hooks';

type Step1SessionPickerProps = {
  title?: string;
  staffId: string;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  /** Meeting-style picker: simple list using `sessions.long_name` (fallback to short name). */
  variant?: 'cards' | 'compactList';
};

export function Step1SessionPicker({
  title,
  staffId,
  selectedSessionId,
  onSelectSession,
  variant = 'cards',
}: Step1SessionPickerProps) {
  const { data, isLoading } = useUnloggedSessionsForStaff(staffId);

  const sessions = data?.sessions || [];
  const sessionStudents = data?.sessionStudents || {};
  const sessionStaff = data?.sessionStaff || {};
  const classesById = data?.classesById || {};
  const subjectsById = data?.subjectsById || {};

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions available to log.</p>
        <p className="text-sm text-muted-foreground mt-2">
          All past sessions have been logged or you have no sessions assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      {variant === 'compactList' ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                const label =
                  session.long_name?.trim() || getShortSessionName(session);
                return (
                  <TableRow
                    key={session.id}
                    className={cn(
                      'cursor-pointer',
                      isSelected && 'bg-primary/10'
                    )}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <TableCell className="font-medium">{label}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const isSelected = session.id === selectedSessionId;
            const classData = session.class_id ? classesById[session.class_id] : undefined;
            const subject = classData?.subject_id ? subjectsById[classData.subject_id] : undefined;
            type StaffRow = Tables<'staff'> & { staff?: Tables<'staff'>; planned_absence?: boolean };
            type StudentRow = Tables<'students'> & {
              student?: Tables<'students'>;
              planned_absence?: boolean;
              is_extra?: boolean;
            };
            const staff = (sessionStaff[session.id] || []).map((sf: StaffRow) => ({
              ...(sf.staff ?? sf),
              planned_absence: sf.planned_absence,
            }));
            const students = (sessionStudents[session.id] || []).map((ss: StudentRow) => ({
              ...(ss.student ?? ss),
              planned_absence: ss.planned_absence,
              is_extra: ss.is_extra,
            }));

            return (
              <div
                key={session.id}
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected && 'ring-2 ring-primary rounded-lg'
                )}
                onClick={() => onSelectSession(session.id)}
              >
                <SessionsCard
                  session={session}
                  classData={classData}
                  subject={subject}
                  staff={staff}
                  students={students}
                  isSelecting={true}
                  isSelected={isSelected}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


