'use client';

import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { cn } from '@/shared/utils/index';
import { useUnloggedSessionsForStaff } from '../../hooks';

type Step1SessionPickerProps = {
  title?: string;
  staffId: string;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
};

export function Step1SessionPicker({
  title,
  staffId,
  selectedSessionId,
  onSelectSession,
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
      <div className="grid gap-3">
        {sessions.map((session) => {
          const isSelected = session.id === selectedSessionId;
          const classData = session.class_id ? classesById[session.class_id] : undefined;
          const subject = classData?.subject_id ? subjectsById[classData.subject_id] : undefined;
          const staff = (sessionStaff[session.id] || []).map((sf: any) => ({
            ...sf.staff || sf,
            planned_absence: sf.planned_absence,
          }));
          const students = (sessionStudents[session.id] || []).map((ss: any) => ({
            ...ss.student || ss,
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
    </div>
  );
}


