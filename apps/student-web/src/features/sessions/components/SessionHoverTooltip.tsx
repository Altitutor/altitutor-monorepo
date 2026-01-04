'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger, Separator, Badge, Button } from '@altitutor/ui';
import type { Database } from '@altitutor/shared';
import { formatSessionType, getSubjectColorStyle, formatSubjectDisplay } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useMediaQuery } from '@/shared/hooks';
import { cn } from '@/shared/utils';
import { LogAbsenceDialog } from './LogAbsenceDialog';
import { BookDraftingSessionModal } from '@/features/bookings/components/BookDraftingSessionModal';
import { CalendarX } from 'lucide-react';
import type { StudentSession as AbsenceStudentSession } from '../types/absence';

type StudentSession = Database['public']['Views']['vstudent_session_base']['Row'];

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface StudentMember {
  id: string;
  first_name: string;
  last_name: string;
  year_level?: number;
}

interface SessionHoverTooltipProps {
  session: StudentSession & {
    staff: StaffMember[];
    students: StudentMember[];
  };
  children: React.ReactNode;
}

// Helper to format session date like SessionModal
function formatSessionDate(date: Date | string): string {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = DAY_NAMES[d.getDay()];
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${dayName} ${day}/${month}/${year}`;
}

// Simplified StudentCard component
function StudentCard({ 
  student, 
  isGreyedOut = false 
}: { 
  student: StudentMember; 
  isGreyedOut?: boolean;
}) {
  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();
  
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 border rounded-lg bg-background",
      isGreyedOut && "opacity-50"
    )}>
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm">
          {student.first_name} {student.last_name}
        </h4>
        {student.year_level && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              Year {student.year_level}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Simplified StaffCard component
function StaffCard({ staff }: { staff: StaffMember }) {
  const initials = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase();
  const roleDisplay = staff.role === 'TUTOR' ? 'Tutor' : staff.role === 'ADMINSTAFF' ? 'Admin Staff' : staff.role || '';
  
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
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

export function SessionHoverTooltip({ session, children }: SessionHoverTooltipProps) {
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isDraftingRescheduleModalOpen, setIsDraftingRescheduleModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)'); // md breakpoint

  // Get current student ID
  useEffect(() => {
    const loadStudentId = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('current_student_id');
      if (!error && data) {
        setCurrentStudentId(data);
      }
    };
    loadStudentId();
  }, []);

  // Build subject display: {curriculum} {year_level} {name} {level}
  const subjectParts: string[] = [];
  if (session.subject_curriculum) {
    subjectParts.push(session.subject_curriculum);
  }
  const yearLevel = (session as any).subject_year_level ?? session.subject_level;
  if (yearLevel !== null && yearLevel !== undefined) {
    subjectParts.push(String(yearLevel));
  }
  if (session.subject_name) {
    subjectParts.push(session.subject_name);
  }
  if ((session as any).class_level) {
    subjectParts.push((session as any).class_level);
  }
  const subjectDisplay = subjectParts.length > 0 ? subjectParts.join(' ') : formatSessionType(session.session_type);

  // Format time (using Adelaide timezone)
  const timeDisplay = session.start_at && session.end_at
    ? (() => {
        const startDate = new Date(session.start_at);
        const endDate = new Date(session.end_at);
        const startTime = startDate.toLocaleTimeString('en-AU', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Australia/Adelaide',
          hour12: true,
        });
        const endTime = endDate.toLocaleTimeString('en-AU', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Australia/Adelaide',
          hour12: true,
        });
        return `${startTime} - ${endTime}`;
      })()
    : session.start_time && session.end_time
    ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
    : '—';

  // Format day
  const dayDisplay = session.start_at 
    ? formatSessionDate(session.start_at)
    : session.day_of_week !== null && session.day_of_week !== undefined
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][session.day_of_week]
    : '—';

  // Check if current student has planned absence
  const isCurrentStudentAbsent = session.planned_absence === true;

  // Create subject object for colored pill
  const subjectForPill = session.subject_id ? {
    id: session.subject_id,
    name: session.subject_name || null,
    curriculum: session.subject_curriculum || null,
    year_level: (session as any).subject_year_level ?? null,
    level: session.subject_level || null,
    color: session.subject_color || null,
  } as any : null;

  // Convert session to AbsenceStudentSession format for LogAbsenceDialog
  const absenceSession: AbsenceStudentSession | null = 
    session.session_student_id && session.session_id ? {
      id: session.session_id,
      start_at: session.start_at,
      end_at: session.end_at,
      class_id: session.class_id,
      type: session.session_type || 'CLASS',
      billing_type: null,
      status: 'SCHEDULED',
      subject_id: session.subject_id,
      created_at: null,
      updated_at: null,
      class: session.class_id ? {
        id: session.class_id,
        day_of_week: session.day_of_week,
        start_time: session.start_time,
        end_time: session.end_time,
        room: session.room,
        level: (session as any).class_level,
        status: session.class_status || 'ACTIVE',
        subject_id: session.subject_id,
        created_at: null,
        updated_at: null,
      } as any : null,
      subject: session.subject_id ? {
        id: session.subject_id,
        name: session.subject_name || null,
        curriculum: session.subject_curriculum || null,
        discipline: null,
        level: session.subject_level || null,
        color: session.subject_color || null,
        year_level: (session as any).subject_year_level ?? null,
        created_at: null,
        updated_at: null,
      } as any : null,
      sessionsStudentsId: session.session_student_id,
    } : null;

  // Determine if reschedule button should be shown based on session type
  const sessionType = session.session_type;
  const shouldShowRescheduleButton = 
    absenceSession && 
    !isCurrentStudentAbsent && 
    (sessionType === 'CLASS' || sessionType === 'DRAFTING');
  const isDraftingSession = sessionType === 'DRAFTING';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] max-w-[calc(100vw-2rem)] p-0 max-h-[80vh] overflow-y-auto md:overflow-y-visible" 
        side={isMobile ? "bottom" : "right"}
        sideOffset={8}
        align="start"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold">{formatSessionType(session.session_type)}</h3>
            <p className="text-sm text-muted-foreground mt-1">{subjectDisplay}</p>
          </div>

          {/* Session Information */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Session Information</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="font-medium text-muted-foreground">Day:</div>
              <div>{dayDisplay}</div>
              
              <div className="font-medium text-muted-foreground">Time:</div>
              <div>{timeDisplay}</div>
              
              <div className="font-medium text-muted-foreground">Subject:</div>
              <div>
                {subjectForPill ? (() => {
                  const { style, textColorClass } = getSubjectColorStyle(subjectForPill);
                  const defaultClass = !subjectForPill.color ? 'bg-gray-100 text-gray-800' : '';
                  return (
                    <Badge 
                      className={defaultClass || textColorClass}
                      style={style.backgroundColor ? style : undefined}
                    >
                      {formatSubjectDisplay(subjectForPill)}
                    </Badge>
                  );
                })() : (
                  subjectDisplay
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Students */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Students ({session.students.length})
            </h4>
            {session.students.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No students
              </div>
            ) : (
              <div className="space-y-2">
                {session.students.map((student) => {
                  // Only show planned absence for current student
                  const isGreyedOut = currentStudentId === student.id && isCurrentStudentAbsent;
                  return (
                    <StudentCard 
                      key={student.id} 
                      student={student}
                      isGreyedOut={isGreyedOut}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Staff */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Staff ({session.staff.length})
            </h4>
            {session.staff.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No staff
              </div>
            ) : (
              <div className="space-y-2">
                {session.staff.map((staffMember) => (
                  <StaffCard key={staffMember.id} staff={staffMember} />
                ))}
              </div>
            )}
          </div>

          {/* Reschedule Session Button */}
          {shouldShowRescheduleButton && (
            <>
              <Separator />
              <div>
                <Button
                  onClick={() => {
                    if (isDraftingSession) {
                      setIsDraftingRescheduleModalOpen(true);
                    } else {
                      setIsAbsenceModalOpen(true);
                    }
                    setIsOpen(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <CalendarX className="mr-2 h-4 w-4" />
                  Reschedule Session
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
      <LogAbsenceDialog
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        initialSession={absenceSession}
      />
      <BookDraftingSessionModal
        isOpen={isDraftingRescheduleModalOpen}
        onClose={() => setIsDraftingRescheduleModalOpen(false)}
        originalSessionId={absenceSession?.id || null}
        originalSubjectId={session.subject_id || null}
        onBookingCreated={() => {
          // Optionally refresh data or show notification
        }}
      />
    </Popover>
  );
}
