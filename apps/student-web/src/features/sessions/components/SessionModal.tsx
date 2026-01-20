'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Badge } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { sessionsApi } from '../api/sessions';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { cn } from '@/shared/utils';

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

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);

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

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !sessionId) return;
      setIsLoading(true);
      try {
        // Use getSessionWithDetails which returns data from vstudent_session_detail view
        const result = await sessionsApi.getSessionWithDetails(sessionId);
        setData(result);
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen && sessionId) {
      load();
    } else if (!isOpen) {
      // Delay state reset to allow exit animation to complete
      const timer = setTimeout(() => {
        setData(null);
      }, 300); // Match Sheet animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, sessionId]);

  // Always render the Sheet to allow exit animation
  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <div className="flex-1 overflow-y-auto p-6">
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
  const session = data;
  const sessionsStudents = (data.students || []).map((student: any) => ({
    student_id: student.id,
    student: student,
  }));
  const sessionsStaff = (data.staff || []).map((staffMember: any) => ({
    staff_id: staffMember.id,
    staff: staffMember,
    type: staffMember.type,
  }));
  
  const sessionTitle = getSessionTitle(session);
  
  // Build subject object from flattened fields
  const subject = (session as any).subject_name ? {
    id: (session as any).subject_id,
    name: (session as any).subject_name,
    curriculum: (session as any).subject_curriculum,
    discipline: (session as any).subject_discipline,
    level: (session as any).subject_level,
    color: (session as any).subject_color,
    year_level: (session as any).subject_year_level,
    short_name: (session as any).subject_short_name,
    long_name: (session as any).subject_long_name,
  } as Tables<'subjects'> : null;

  // Check if current student has planned absence (from session.planned_absence)
  // The vstudent_session_detail view includes planned_absence for the current student
  const isCurrentStudentAbsent = session.planned_absence === true;
  
  // Find current student's data
  const currentStudentData = currentStudentId 
    ? sessionsStudents.find((ss: any) => ss.student_id === currentStudentId)
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
        <div className="flex-1 overflow-y-auto p-6">
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
              <h3 className="text-lg font-semibold mb-4">Session Information</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium text-muted-foreground">Day:</div>
                <div className="text-sm">{session.start_at ? formatSessionDate(session.start_at) : '—'}</div>
                
                <div className="text-sm font-medium text-muted-foreground">Time:</div>
                <div className="text-sm">
                  {(() => {
                    if (session.start_at && session.end_at) {
                      const startDate = new Date(session.start_at);
                      const endDate = new Date(session.end_at);
                      const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
                      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                      return `${formatTime(startTime)} - ${formatTime(endTime)}`;
                    }
                    // Check for flattened structure (from vstudent_session_detail)
                    if ((session as any).start_time && (session as any).end_time) {
                      return `${formatTime((session as any).start_time)} - ${formatTime((session as any).end_time)}`;
                    }
                    return '—';
                  })()}
                </div>
                
                <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                <div className="text-sm">
                  {subject ? (() => {
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
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Students Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Students ({sessionsStudents.length})</h3>
              {sessionsStudents.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No students planned
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsStudents.map((ss: any) => {
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

            <Separator />

            {/* Staff Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Staff ({sessionsStaff.length})</h3>
              {sessionsStaff.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No staff planned
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsStaff.map((sf: any) => (
                    <StaffCard
                      key={sf.staff_id}
                      staff={sf.staff}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

