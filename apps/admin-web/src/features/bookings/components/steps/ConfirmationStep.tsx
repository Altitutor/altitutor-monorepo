import { BookingConfirmationCalendar } from '../BookingConfirmationCalendar';
import { formatStudentDisplay } from '../../utils/bookingHelpers';
import { formatSlotDateTime } from '../../utils/dateTimeHelpers';
import type { Tables } from '@altitutor/shared';
import type { AdminTrialContactFormValues } from '../AdminTrialContactForm';
import { formatStudentParentDraftLabel } from '@/features/students/utils/studentParentDrafts';
import { PropertyForm, PropertyFormRow } from '@/shared/components/PropertyForm';

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
        <PropertyForm>
          {sessionType === 'TRIAL_SESSION' && trialContactData ? (
            <>
              <PropertyFormRow label="First name">
                <div className="text-sm">{trialContactData.student_first_name}</div>
              </PropertyFormRow>
              {trialContactData.student_last_name && (
                <PropertyFormRow label="Last name">
                  <div className="text-sm">{trialContactData.student_last_name}</div>
                </PropertyFormRow>
              )}
              {trialContactData.student_email && (
                <PropertyFormRow label="Email">
                  <div className="text-sm">{trialContactData.student_email}</div>
                </PropertyFormRow>
              )}
              {trialContactData.student_phone && (
                <PropertyFormRow label="Phone">
                  <div className="text-sm">{trialContactData.student_phone}</div>
                </PropertyFormRow>
              )}
              {trialContactData.curriculum && (
                <PropertyFormRow label="Curriculum">
                  <div className="text-sm">{trialContactData.curriculum}</div>
                </PropertyFormRow>
              )}
              {trialContactData.year_level && (
                <PropertyFormRow label="Year level">
                  <div className="text-sm">{trialContactData.year_level}</div>
                </PropertyFormRow>
              )}
              {trialContactData.subject_ids && trialContactData.subject_ids.length > 0 && subjects && (
                <PropertyFormRow label="Subjects">
                  <div className="text-sm">
                    {trialContactData.subject_ids
                      .map((id) => {
                        const subject = subjects.find((s) => s.id === id);
                        return subject?.long_name ?? null;
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </PropertyFormRow>
              )}
              {!trialContactData.skip_parent_details &&
                (trialContactData.parents ?? []).length > 0 && (
                <PropertyFormRow label="Parents">
                  <div className="text-sm">
                    {(trialContactData.parents ?? [])
                      .map((parent) => formatStudentParentDraftLabel({
                        existing_id: parent.existing_id,
                        first_name: parent.first_name || '',
                        last_name: parent.last_name || '',
                        email: parent.email || '',
                        phone: parent.phone ?? null,
                      }))
                      .join(', ')}
                  </div>
                </PropertyFormRow>
              )}
            </>
          ) : (
            <>
              <PropertyFormRow label="Student">
                <div className="text-sm">
                  {selectedStudentId && studentsData
                    ? (() => {
                        const student = studentsData.find((s) => s.id === selectedStudentId);
                        return student ? formatStudentDisplay(student) : 'Unknown';
                      })()
                    : 'Unknown'}
                </div>
              </PropertyFormRow>
              {selectedSubject && (
                <PropertyFormRow label="Subject">
                  <div className="text-sm">{selectedSubject?.long_name ?? ''}</div>
                </PropertyFormRow>
              )}
            </>
          )}
          <PropertyFormRow label="Date & time">
            <div className="text-sm">{formatSlotDateTime(selectedSlot.startAt)}</div>
          </PropertyFormRow>
          <PropertyFormRow label="Duration">
            <div className="text-sm">{durationMinutes} minutes</div>
          </PropertyFormRow>
        </PropertyForm>
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
