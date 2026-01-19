import { BookingConfirmationCalendar } from '../BookingConfirmationCalendar';
import { formatSubjectDisplay, formatStudentDisplay } from '../../utils/bookingHelpers';
import { formatSlotDateTime } from '../../utils/dateTimeHelpers';
import type { Tables } from '@altitutor/shared';
import type { AdminTrialContactFormValues } from '../AdminTrialContactForm';

interface ConfirmationStepProps {
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  selectedSlot: { startAt: string; endAt: string; availableStaffIds: string[] };
  selectedStudentId?: string;
  selectedSubjectId?: string;
  trialContactData?: AdminTrialContactFormValues | null;
  studentsData?: Tables<'students'>[];
  subjects?: Tables<'subjects'>[];
  studentSubjects?: Tables<'subjects'>[];
  durationMinutes: number;
  sessionsData?: {
    sessions: Tables<'sessions'>[];
    subjectsById?: Record<string, Tables<'subjects'>>;
    classesById?: Record<string, Tables<'classes'>>;
    sessionStaff?: Record<string, Array<Tables<'staff'>>>;
    sessionStudents?: Record<string, Array<Tables<'students'>>>;
  };
  selectedStaff?: Tables<'staff'> | null;
  selectedStudent?: Tables<'students'> | null;
}

export function ConfirmationStep({
  sessionType,
  selectedSlot,
  selectedStudentId,
  selectedSubjectId,
  trialContactData,
  studentsData,
  subjects,
  studentSubjects,
  durationMinutes,
  sessionsData,
  selectedStaff,
  selectedStudent,
}: ConfirmationStepProps) {
  if (!selectedSlot || (!selectedStudentId && !trialContactData)) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please complete the previous steps</p>
      </div>
    );
  }

  const selectedSubject = selectedSubjectId
    ? (sessionType === 'DRAFTING' ? studentSubjects : subjects)?.find((s) => s.id === selectedSubjectId)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Booking Details</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {sessionType === 'TRIAL_SESSION' && trialContactData ? (
            <>
              {/* Show all student details for trial session */}
              <div className="text-sm font-medium text-muted-foreground">First Name:</div>
              <div className="text-sm">{trialContactData.student_first_name}</div>
              
              <div className="text-sm font-medium text-muted-foreground">Last Name:</div>
              <div className="text-sm">{trialContactData.student_last_name}</div>
              
              {trialContactData.student_email && (
                <>
                  <div className="text-sm font-medium text-muted-foreground">Email:</div>
                  <div className="text-sm">{trialContactData.student_email}</div>
                </>
              )}
              
              <div className="text-sm font-medium text-muted-foreground">Phone:</div>
              <div className="text-sm">{trialContactData.student_phone}</div>
              
              {trialContactData.curriculum && (
                <>
                  <div className="text-sm font-medium text-muted-foreground">Curriculum:</div>
                  <div className="text-sm">{trialContactData.curriculum}</div>
                </>
              )}
              
              {trialContactData.year_level && (
                <>
                  <div className="text-sm font-medium text-muted-foreground">Year Level:</div>
                  <div className="text-sm">{trialContactData.year_level}</div>
                </>
              )}
              
              {trialContactData.subject_ids && trialContactData.subject_ids.length > 0 && subjects && (
                <>
                  <div className="text-sm font-medium text-muted-foreground">Subjects:</div>
                  <div className="text-sm">
                    {trialContactData.subject_ids
                      .map((id) => {
                        const subject = subjects.find((s) => s.id === id);
                        return subject ? formatSubjectDisplay(subject) : null;
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </>
              )}
              
              {!trialContactData.skip_parent_details && (
                <>
                  {trialContactData.parent_first_name && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Parent First Name:</div>
                      <div className="text-sm">{trialContactData.parent_first_name}</div>
                    </>
                  )}
                  {trialContactData.parent_last_name && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Parent Last Name:</div>
                      <div className="text-sm">{trialContactData.parent_last_name}</div>
                    </>
                  )}
                  {trialContactData.parent_email && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Parent Email:</div>
                      <div className="text-sm">{trialContactData.parent_email}</div>
                    </>
                  )}
                  {trialContactData.parent_phone && (
                    <>
                      <div className="text-sm font-medium text-muted-foreground">Parent Phone:</div>
                      <div className="text-sm">{trialContactData.parent_phone}</div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Existing student display */}
              <div className="text-sm font-medium text-muted-foreground">Student:</div>
              <div className="text-sm">
                {selectedStudentId && studentsData
                  ? (() => {
                      const student = studentsData.find((s) => s.id === selectedStudentId);
                      return student ? formatStudentDisplay(student) : 'Unknown';
                    })()
                  : 'Unknown'}
              </div>
              
              {selectedSubject && (
                <>
                  <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                  <div className="text-sm">{formatSubjectDisplay(selectedSubject)}</div>
                </>
              )}
            </>
          )}
          
          <div className="text-sm font-medium text-muted-foreground">Date & Time:</div>
          <div className="text-sm">{formatSlotDateTime(selectedSlot.startAt)}</div>
          
          <div className="text-sm font-medium text-muted-foreground">Duration:</div>
          <div className="text-sm">{durationMinutes} minutes</div>
        </div>
      </div>

      {/* Calendar View */}
      {sessionsData && (
        <div className="mt-6">
          <h3 className="font-semibold mb-4">Session in Calendar</h3>
          <BookingConfirmationCalendar
            newSession={{
              start_at: selectedSlot.startAt,
              end_at: selectedSlot.endAt,
              type: sessionType,
              subject_id: selectedSubjectId || null,
            }}
            existingSessions={sessionsData.sessions
              .filter((s) => s.start_at && s.end_at)
              .map((s) => ({
                id: s.id,
                start_at: s.start_at!,
                end_at: s.end_at!,
                type: s.type,
                subject_id: s.subject_id,
                class_id: s.class_id,
              }))}
            subjectsById={sessionsData.subjectsById || {}}
            classesById={sessionsData.classesById || {}}
            sessionStaff={{
              ...sessionsData.sessionStaff,
              'new-session-preview': selectedStaff ? [selectedStaff] : [],
            }}
            sessionStudents={{
              ...sessionsData.sessionStudents,
              'new-session-preview': selectedStudent ? [selectedStudent] : [],
            }}
          />
        </div>
      )}
    </div>
  );
}
