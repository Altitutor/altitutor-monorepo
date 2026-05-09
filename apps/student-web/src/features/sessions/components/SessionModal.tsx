'use client';

import Link from 'next/link';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Badge,
  SessionInfoGrid,
} from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { getSessionTitle, formatSessionDate, type FlattenedSessionDetail } from '../utils/session-helpers';
import { formatSessionTimeRangeForDisplay } from '@altitutor/shared';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { useCurrentStudentId } from '@/shared/hooks';
import { useSessionWithDetails } from '../hooks/useSessionWithDetails';
import { useSessionTutorLogResources } from '../hooks/useSessionTutorLogResources';
import { TopicFilesList } from '@/features/resources/components/topic-files-list';
import { cn } from '@/shared/utils';
import {
  studentBtnOutline,
  studentModalHairline,
  studentModalInsetCard,
  studentModalShell,
} from '@/shared/lib/student-visual';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

// StudentCard component
function StudentCard({ 
  student, 
  isGreyedOut = false,
  showAttendance = false,
  isAbsent = false,
  isCurrentStudent = false
}: { 
  student: {
    id: string;
    first_name: string;
    last_name: string;
    year_level?: number;
  }; 
  isGreyedOut?: boolean;
  showAttendance?: boolean;
  isAbsent?: boolean;
  isCurrentStudent?: boolean;
}) {
  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();
  
  return (
    <div className={cn(studentModalInsetCard, 'flex items-start gap-3', isGreyedOut && 'opacity-50')}>
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {student.first_name} {student.last_name}
              {isCurrentStudent && (
                <span className="text-xs text-muted-foreground ml-2">(You)</span>
              )}
            </h4>
            {student.year_level && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  Year {student.year_level}
                </span>
              </div>
            )}
          </div>
          {showAttendance && (
            <div className="flex-shrink-0">
              {isAbsent ? (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
                  Planned Absence
                </Badge>
              ) : (
                <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  Attending
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// StaffCard component
function StaffCard({ staff }: { 
  staff: {
    id: string;
    first_name: string;
    last_name: string;
    role?: string;
  } 
}) {
  const initials = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase();
  const roleDisplay = staff.role === 'TUTOR' ? 'Tutor' : staff.role === 'ADMINSTAFF' ? 'Admin Staff' : staff.role || '';
  
  return (
    <div className={cn(studentModalInsetCard, 'flex items-start gap-3')}>
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm">
          {staff.first_name} {staff.last_name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {roleDisplay}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const { data: currentStudentId } = useCurrentStudentId();
  const { data, isLoading } = useSessionWithDetails(sessionId, isOpen && !!sessionId);
  const sessionRowForLog = data ? (data as unknown as FlattenedSessionDetail) : null;
  const { data: tutorLogResources } = useSessionTutorLogResources(
    sessionId,
    sessionRowForLog,
    isOpen && !!sessionId,
  );

  // Always render the Sheet to allow exit animation
  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          className={cn(
            studentModalShell,
            'flex h-full max-h-[100dvh] w-full flex-col overflow-hidden rounded-none rounded-l-2xl p-0 md:w-[600px] md:max-w-none [&>button]:rounded-xl [&>button]:hover:bg-muted/80',
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>{isLoading ? 'Loading...' : ''}</SheetTitle>
            </SheetHeader>
            {isLoading && (
              <div className="py-6 text-center text-muted-foreground">Loading session details...</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // The data from vstudent_session_detail is a single row with flattened fields
  const session = data as unknown as FlattenedSessionDetail & { planned_absence?: boolean };
  const students = Array.isArray(session.students) ? (session.students as NonNullable<FlattenedSessionDetail['students']>) : [];
  const staff = Array.isArray(session.staff) ? (session.staff as NonNullable<FlattenedSessionDetail['staff']>) : [];
  const sessionsStudents = students.map((student: { id: string; first_name: string; last_name: string; year_level?: number }) => ({
    student_id: student.id,
    student,
  }));
  const sessionsStaff = staff.map((staffMember: { id: string; first_name: string; last_name: string; role?: string; type?: string }) => ({
    staff_id: staffMember.id,
    staff: staffMember,
    type: staffMember.type,
  }));
  
  const sessionTitle = getSessionTitle(session);
  
  // Build subject object from flattened fields (FlattenedSessionDetail has these)
  const flatSession = session as FlattenedSessionDetail;
  const subject = flatSession.subject_name ? {
    id: flatSession.subject_id,
    name: flatSession.subject_name,
    curriculum: flatSession.subject_curriculum,
    discipline: flatSession.subject_discipline,
    level: flatSession.subject_level,
    color: flatSession.subject_color,
    year_level: flatSession.subject_year_level,
    short_name: flatSession.subject_short_name,
    long_name: flatSession.subject_long_name,
  } as Tables<'subjects'> : null;

  // Check if current student has planned absence (from session.planned_absence)
  // The vstudent_session_detail view includes planned_absence for the current student
  const isCurrentStudentAbsent = (session as { planned_absence?: boolean }).planned_absence === true;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className={cn(
          studentModalShell,
          'flex h-full max-h-[100dvh] w-full flex-col overflow-hidden rounded-none rounded-l-2xl p-0 md:w-[600px] md:max-w-none [&>button]:rounded-xl [&>button]:hover:bg-muted/80',
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <SheetHeader className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>Session Details</SheetTitle>
                <SheetDescription className="text-lg font-medium">
                  {sessionTitle}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="space-y-6">
            {/* Session Information */}
            <div>
              <h3 className="mb-4 text-2xl font-semibold">Session Information</h3>
              <SessionInfoGrid
                day={session.start_at ? formatSessionDate(session.start_at) : '—'}
                time={formatSessionTimeRangeForDisplay(session, formatTime)}
                subjectNode={
                  subject ? (() => {
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge
                        className={defaultClass || textColorClass}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectDisplay(subject)}
                      </Badge>
                    );
                  })() : (
                    '—'
                  )
                }
              />
            </div>

            <div className={cn(studentModalHairline, 'my-6')} />

            {/* Students Section */}
            <div>
              <h3 className="mb-4 text-2xl font-semibold">Students</h3>
              {sessionsStudents.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No students planned
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsStudents.map((ss: { student_id: string; student: { id: string; first_name: string; last_name: string; year_level?: number } }) => {
                    const isCurrentStudent = ss.student_id === currentStudentId;
                    return (
                      <StudentCard
                        key={ss.student_id}
                        student={ss.student}
                        isGreyedOut={isCurrentStudent && isCurrentStudentAbsent}
                        showAttendance={isCurrentStudent}
                        isAbsent={isCurrentStudent && isCurrentStudentAbsent}
                        isCurrentStudent={isCurrentStudent}
                      />
                    );
                  })}
                </div>
              )}
            </div>


            {/* Staff Section */}
            <div>
              <h3 className="mb-4 text-2xl font-semibold">Tutors</h3>
              {sessionsStaff.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No staff planned
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsStaff.map((sf: { staff_id: string; staff: { id: string; first_name: string; last_name: string; role?: string } }) => (
                    <StaffCard
                      key={sf.staff_id}
                      staff={sf.staff}
                    />
                  ))}
                </div>
              )}
            </div>

            {tutorLogResources ? (
              <>
                <div className={cn(studentModalHairline, 'my-6')} />
                <div>
                  <h3 className="mb-4 text-2xl font-semibold">Topics covered</h3>
                  {tutorLogResources.topicSections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No topics or files were linked to you in this session&apos;s log.
                    </p>
                  ) : (
                    <div className="space-y-10">
                      {tutorLogResources.topicSections.map((section) => {
                        const short = section.subjectShortName.trim();
                        const getFileHref = (fileCode: string) =>
                          short
                            ? `/resources/${encodeURIComponent(short)}/${encodeURIComponent(section.code)}/${encodeURIComponent(fileCode.toLowerCase())}`
                            : '#';

                        const topicHref =
                          short && section.code !== '—'
                            ? `/resources/${encodeURIComponent(short)}/${encodeURIComponent(section.code)}`
                            : null;

                        return (
                          <div key={section.topicId}>
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <p className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-foreground">
                                <span className="line-clamp-2">{section.code} · {section.name}</span>
                              </p>
                              {topicHref ? (
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className={cn(studentBtnOutline, 'shrink-0')}
                                >
                                  <Link href={topicHref}>Go to topic</Link>
                                </Button>
                              ) : null}
                            </div>
                            <TopicFilesList
                              files={section.files}
                              getFileHref={getFileHref}
                              fileTypeHeadingClassName="mb-2 text-base font-semibold text-foreground"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

