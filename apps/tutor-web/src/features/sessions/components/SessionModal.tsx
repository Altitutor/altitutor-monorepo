'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button } from '@altitutor/ui';
import { Separator, Badge } from '@altitutor/ui';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { StudentCard, StaffCard } from '@/shared/components';
import { AttendanceCell } from './AttendanceCell';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { useSessionNotes } from '../hooks/useSessionNotes';
import { SessionNotes } from './SessionNotes';
import { useSessionModalData } from '../hooks/useSessionModalData';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
  /** Called when user clicks "Add Tutor Log" - parent should open LogSessionModal with preselectedSessionId */
  onLogSessionClick?: () => void;
  /** Current staff ID - when provided, shows "Add Tutor Log" button when session has no log yet */
  currentStaffId?: string | null;
  /** Passed to SessionNotes for filtering/authorization */
  currentStaffIdForNotes?: string | null;
  /** When this value changes, session data is refreshed (e.g. after LogSessionModal completes) */
  refreshTrigger?: number;
};

export function SessionModal({
  isOpen,
  sessionId,
  onClose,
  onLogSessionClick,
  currentStaffId,
  currentStaffIdForNotes,
  refreshTrigger,
}: SessionModalProps) {
  // Fetch session notes
  const { data: notesData } = useSessionNotes(sessionId || '');

  // Use hook for all session data loading and processing
  const {
    session,
    tutorLog,
    allTopics,
    studentsData,
    staffData,
    subject,
    isLoading,
    refresh,
  } = useSessionModalData({
    isOpen,
    sessionId,
  });

  // Refresh session data when log modal completes (parent increments refreshTrigger)
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0 && sessionId) {
      refresh();
    }
  }, [refreshTrigger, sessionId, refresh]);

  // Always render the Sheet to allow exit animation
  if (isLoading || !session) {
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

  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;

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
                    // Check for flattened structure (from vtutor_session_detail)
                    if ('start_time' in session && 'end_time' in session && session.start_time && session.end_time) {
                      return `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`;
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Students ({studentsData.length})</h3>
                {studentsData.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">Planned</span>
                    <span className="text-xs text-muted-foreground">Actual</span>
                  </div>
                )}
              </div>
              {studentsData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No students planned
                </div>
              ) : (
                <div className="space-y-3">
                  {studentsData.map((data: any) => (
                    <div key={data.student.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <StudentCard
                          student={data.student}
                          showSubjects={false}
                        />
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <AttendanceCell status={data.plannedStatus} />
                        <AttendanceCell status={data.actualStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Staff Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Staff ({staffData.length})</h3>
                {staffData.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">Planned</span>
                    <span className="text-xs text-muted-foreground">Actual</span>
                  </div>
                )}
              </div>
              {staffData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No staff planned
                </div>
              ) : (
                <div className="space-y-3">
                  {staffData.map((data: any) => (
                    <div key={data.staff.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <StaffCard
                          staff={data.staff}
                          subjects={data.staff.subjects || []}
                          showSubjects={false}
                        />
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <AttendanceCell status={data.plannedStatus} />
                        <AttendanceCell status={data.actualStatus} staffType={data.staffType} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Tutor Log Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tutor Log</h3>
                {!hasTutorLog &&
                  sessionId &&
                  currentStaffId &&
                  onLogSessionClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLogSessionClick}
                    >
                      Add Tutor Log
                    </Button>
                  )}
              </div>

              {/* Topics Covered Section */}
              {hasTutorLog && tutorLog.topics && tutorLog.topics.length > 0 && (
                <div className="space-y-4 mb-4">
                  {tutorLog.topics.map((topicData: any) => {
                    // vtutor_tutor_log returns topics with topic_id, topic_name, etc.
                    // Find the complete topic record from allTopics
                    const topic = allTopics.find(t => t.id === topicData.topic_id);
                    const topicName = topicData.topic_name || topic?.name || 'Unknown Topic';
                    const topicCode = topic?.code || '';
                    
                    // Get files for this topic from tutorLog.files
                    const topicFiles = (tutorLog.files || []).filter((f: any) => f.topic_id === topicData.topic_id);
                    
                    // Get student IDs from topicData.student_ids (array of IDs)
                    const studentIds = topicData.student_ids || [];
                    
                    return (
                      <div key={topicData.id} className="border rounded-lg p-4 space-y-3">
                        <div>
                          <div className="font-medium">
                            {topicCode ? `${topicCode} ` : ''}{topicName}
                          </div>
                        </div>
                        
                        {topicFiles.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Files:</div>
                            <div className="space-y-1">
                              {topicFiles.map((fileData: any) => {
                                const fileCode = fileData.code || fileData.filename || '';
                                
                                return (
                                  <div
                                    key={fileData.id}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {fileCode}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {studentIds.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Students:</div>
                            <div className="text-sm text-muted-foreground">
                              {studentIds.length} student{studentIds.length !== 1 ? 's' : ''} assigned
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No Tutor Log Message */}
              {!hasTutorLog && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  This session has not been logged yet.
                </div>
              )}
            </div>

            <Separator />

            {/* Session Notes Section */}
            {sessionId && (
              <SessionNotes
                sessionId={sessionId}
                notes={(notesData || []) as any}
                onNoteAdded={refresh}
                currentStaffId={currentStaffIdForNotes ?? currentStaffId}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
