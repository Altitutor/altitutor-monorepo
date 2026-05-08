'use client';

import { Separator } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../../types';
import { Step2StaffAttendance } from './Step2StaffAttendance';
import { Step3StudentAttendance, type ParentAttendanceItem } from './Step3StudentAttendance';

type MeetingCombinedAttendanceStepProps = {
  sessionId: string;
  currentStaffId: string | undefined;
  sessionType?: string | null;
  sessionParents: Array<Tables<'parents'> & { sessions_parents_id?: string }>;
  staffAttendance: NonNullable<TutorLogFormData['staffAttendance']>;
  studentAttendance: NonNullable<TutorLogFormData['studentAttendance']>;
  parentAttendance: ParentAttendanceItem[];
  onStaffAttendanceUpdate: (rows: TutorLogFormData['staffAttendance']) => void;
  onStudentAttendanceUpdate: (rows: TutorLogFormData['studentAttendance']) => void;
  onParentAttendanceUpdate: (rows: ParentAttendanceItem[]) => void;
  onAddStaffToSession: (staffId: string) => Promise<void>;
  onAddStudentToSession: (studentId: string) => Promise<void>;
  onAddParentToSession: (parentId: string) => Promise<void>;
};

export function MeetingCombinedAttendanceStep({
  sessionId,
  currentStaffId,
  sessionType,
  sessionParents,
  staffAttendance,
  studentAttendance,
  parentAttendance,
  onStaffAttendanceUpdate,
  onStudentAttendanceUpdate,
  onParentAttendanceUpdate,
  onAddStaffToSession,
  onAddStudentToSession,
  onAddParentToSession,
}: MeetingCombinedAttendanceStepProps) {
  const staffId = currentStaffId || '';

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Staff</h3>
        <Step2StaffAttendance
          sessionId={sessionId}
          currentStaffId={staffId}
          staffAttendance={staffAttendance}
          onUpdate={onStaffAttendanceUpdate}
          onAddStaffToSession={onAddStaffToSession}
          addStaffVariant="search"
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Students</h3>
        <Step3StudentAttendance
          sessionId={sessionId}
          sessionType={sessionType}
          sessionParents={sessionParents}
          studentAttendance={studentAttendance}
          parentAttendance={parentAttendance}
          onUpdate={onStudentAttendanceUpdate}
          onParentAttendanceUpdate={onParentAttendanceUpdate}
          addStudentVariant="search"
          onAddStudentToSession={onAddStudentToSession}
          onAddParentToSession={onAddParentToSession}
          section="students"
        />
      </section>

      {sessionType && sessionType !== 'CLASS' ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Parents</h3>
            <Step3StudentAttendance
              sessionId={sessionId}
              sessionType={sessionType}
              sessionParents={sessionParents}
              studentAttendance={studentAttendance}
              parentAttendance={parentAttendance}
              onUpdate={onStudentAttendanceUpdate}
              onParentAttendanceUpdate={onParentAttendanceUpdate}
              addStudentVariant="search"
              onAddStudentToSession={onAddStudentToSession}
              onAddParentToSession={onAddParentToSession}
              section="parents"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
