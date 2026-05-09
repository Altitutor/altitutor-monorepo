'use client';

import { useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  SessionInfoGrid,
  Separator,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui';
import { getSessionTitle, formatSessionDate } from '../utils/session-helpers';
import { formatSessionTimeRangeForDisplay } from '@altitutor/shared';
import { AttendanceCell } from './AttendanceCell';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { useSessionNotes } from '../hooks/useSessionNotes';
import { SessionNotes } from './SessionNotes';
import { useSessionModalData, type ProcessedStudent, type ProcessedStaff } from '../hooks/useSessionModalData';

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

function TutorLogSubmitterBadge({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium flex-shrink-0 cursor-help"
            title={`Tutor log submitted by ${firstName} ${lastName}`}
          >
            {initials}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tutor log submitted by {firstName} {lastName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SessionModal({
  isOpen,
  sessionId,
  onClose,
  onLogSessionClick,
  currentStaffId,
  currentStaffIdForNotes,
  refreshTrigger,
}: SessionModalProps) {
  const { data: notesData } = useSessionNotes(sessionId || '');

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

  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0 && sessionId) {
      refresh();
    }
  }, [refreshTrigger, sessionId, refresh]);

  if (isLoading || !session) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100dvh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
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

  // Find the tutor log submitter name from staff data
  const tutorLogSubmitter = tutorLog?.created_by
    ? staffData.find((d) => d.staff.id === tutorLog.created_by)?.staff
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="h-full max-h-[100dvh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
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
                  })() : '—'
                }
              />
            </div>

            <Separator />

            {/* Students Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Students ({studentsData.length})</h3>
              </div>
              {studentsData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No students planned
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead>Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsData.map((data: ProcessedStudent) => (
                        <TableRow key={data.student.id}>
                          <TableCell className="font-medium">
                            {data.student.first_name} {data.student.last_name}
                          </TableCell>
                          <TableCell>
                            <AttendanceCell status={data.plannedStatus} />
                          </TableCell>
                          <TableCell>
                            <AttendanceCell status={data.actualStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* Staff Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Staff ({staffData.length})</h3>
              </div>
              {staffData.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No staff planned
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Tutor Log</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffData.map((data: ProcessedStaff) => (
                        <TableRow key={data.staff.id}>
                          <TableCell className="font-medium">
                            {data.staff.first_name} {data.staff.last_name}
                          </TableCell>
                          <TableCell>
                            <AttendanceCell status={data.plannedStatus} />
                          </TableCell>
                          <TableCell>
                            <AttendanceCell
                              status={data.actualStatus}
                              staffType={data.staffType as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | undefined}
                            />
                          </TableCell>
                          <TableCell>
                            {hasTutorLog && tutorLogSubmitter ? (
                              <TutorLogSubmitterBadge
                                firstName={tutorLogSubmitter.first_name ?? ''}
                                lastName={tutorLogSubmitter.last_name ?? ''}
                              />
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* Tutor Log Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tutor Log</h3>
                {!hasTutorLog && sessionId && currentStaffId && onLogSessionClick && (
                  <Button variant="outline" size="sm" onClick={onLogSessionClick}>
                    Add Tutor Log
                  </Button>
                )}
              </div>

              {hasTutorLog && tutorLog.topics && tutorLog.topics.length > 0 && (
                <div className="space-y-4 mb-4">
                  {tutorLog.topics.map((topicData) => {
                    const topic = allTopics.find(t => t.id === topicData.id);
                    const topicName = topicData.name || topic?.name || 'Unknown Topic';
                    const topicCode = topic?.code || '';
                    const topicFiles = (tutorLog.files || []).filter((f) => f.topic_id === topicData.id);

                    return (
                      <div key={topicData.id} className="border rounded-lg p-4 space-y-3">
                        <div className="font-medium">
                          {topicCode ? `${topicCode} ` : ''}{topicName}
                        </div>
                        {topicFiles.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Files:</div>
                            <div className="space-y-1">
                              {topicFiles.map((fileData) => (
                                <div key={fileData.id} className="text-sm text-muted-foreground">
                                  {fileData.code || fileData.filename || ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

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
                notes={notesData ?? []}
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
