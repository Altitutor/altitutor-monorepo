'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '../api/sessions';
import { getSessionTitle } from '../utils/session-helpers';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { SessionFiles } from './SessionFiles';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import { LogSessionModal } from '@/features/tutor-logs';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { classesApi } from '@/features/classes/api/classes';
import { SendBookingConfirmationDialog } from './SendBookingConfirmationDialog';
import { LogAbsenceDialog } from './LogAbsenceDialog';
import { LogStaffAbsenceDialog } from './LogStaffAbsenceDialog';
import { SessionDetailsTab } from './SessionDetailsTab';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [firstClassStaffId, setFirstClassStaffId] = useState<string | null>(null);
  const [isBookingConfirmationDialogOpen, setIsBookingConfirmationDialogOpen] = useState(false);
  const [selectedStudentForBookingConfirmation, setSelectedStudentForBookingConfirmation] = useState<string | null>(null);
  const [isLogStudentAbsenceDialogOpen, setIsLogStudentAbsenceDialogOpen] = useState(false);
  const [selectedStudentForAbsence, setSelectedStudentForAbsence] = useState<string | null>(null);
  const [isLogStaffAbsenceDialogOpen, setIsLogStaffAbsenceDialogOpen] = useState(false);
  const [selectedStaffForAbsence, setSelectedStaffForAbsence] = useState<string | null>(null);
  const openWindow = useChatStore(s => s.openWindow);
  const { data: currentStaff } = useCurrentStaff();

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !sessionId) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(sessionId);
        setData(result);
        
        // Fetch all topics for the subject to derive topic codes
        // Use session's subject if available, otherwise fall back to class's subject
        const subjectId = (result.session as any)?.subject?.id || result.session?.class?.subject?.id;
        if (subjectId) {
          const supabaseClient = (await import('@/shared/lib/supabase/client')).getSupabaseClient() as SupabaseClient<Database>;
          const { data: topicsData } = await supabaseClient
            .from('topics')
            .select('*')
            .eq('subject_id', subjectId)
            .order('index', { ascending: true });
          
          setAllTopics(topicsData || []);
        }

        // If session is a CLASS type and has a class_id, get the first staff member from the class
        if (result.session?.type === 'CLASS' && result.session?.class_id) {
          try {
            const classStaff = await classesApi.getClassStaff(result.session.class_id);
            if (classStaff && classStaff.length > 0) {
              setFirstClassStaffId(classStaff[0].id);
            }
          } catch (error) {
            console.error('Failed to get class staff:', error);
          }
        }
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
        setAllTopics([]);
        setFirstClassStaffId(null);
      }, 300); // Match Sheet animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, sessionId]);

  const handleOpenSession = (id: string) => {
    // Close current modal and open new one
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id } }));
    }, 100);
  };

  const handleOpenStaff = (id: string) => {
    setSelectedStaffId(id);
    setIsStaffModalOpen(true);
  };

  const handleOpenTopic = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-topic-modal', { detail: { id } }));
  };

  const handleOpenFile = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Student' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Staff' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  // Always render the Sheet to allow exit animation
  if (isLoading || !data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] md:max-w-none overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4">
            <SheetTitle>{isLoading ? 'Loading...' : ''}</SheetTitle>
          </SheetHeader>
          {isLoading && (
            <div className="py-6 text-center text-muted-foreground px-6">Loading session details...</div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog } = data;
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;
  // Use session's subject if available, otherwise fall back to class's subject
  const subject = (session as any).subject || session.class?.subject;
  
  // Check if session is in the past
  const isSessionInPast = session.start_at ? new Date(session.start_at) < new Date() : false;
  
  // Get first staff member from class for logging (use sessionsStaff if available, otherwise use firstClassStaffId)
  const getFirstStaffForLogging = () => {
    // If session has staff assigned, use the first one
    if (sessionsStaff && sessionsStaff.length > 0 && sessionsStaff[0].staff_id) {
      return sessionsStaff[0].staff_id;
    }
    // Otherwise use the first class staff member (if fetched)
    return firstClassStaffId || undefined;
  };

  // Build student attendance map from tutor log
  const actualStudentAttendance: Record<string, { attended: boolean }> = {};
  if (tutorLog?.studentAttendance) {
    tutorLog.studentAttendance.forEach((att: any) => {
      actualStudentAttendance[att.student_id] = { attended: att.attended };
    });
  }

  // Build staff attendance map from tutor log
  const actualStaffAttendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att: any) => {
      actualStaffAttendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }

  // Process students
  // Build set of student IDs that are in sessions_students (planned students)
  // Include all planned students regardless of is_extra status
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss: any) => ss.student_id && (ss.sessions_students_id !== null && ss.sessions_students_id !== undefined))
      .map((ss: any) => ss.student_id)
  );
  
  const studentsData = sessionsStudents.map((ss: any) => {
    let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
    let rescheduledDate = '';
    
    // Check if this is an unplanned student (not in sessions_students originally)
    // Unplanned students don't have a sessions_students_id (it's null/undefined)
    // They are in the tutor log but not in sessions_students
    const isUnplanned = (ss.sessions_students_id === null || ss.sessions_students_id === undefined) && ss.is_extra;
    
    if (ss.planned_absence && !isUnplanned) {
      // Only mark as absent if it's a planned student with planned absence
      plannedStatus = 'absent';
      if (ss.is_rescheduled && ss.rescheduled_session?.session) {
        plannedStatus = 'rescheduled';
        const resSession = ss.rescheduled_session.session;
        rescheduledDate = resSession.start_at 
          ? `${format(new Date(resSession.start_at), 'EEE dd/MM')} ${resSession.class?.start_time || ''}`
          : '';
      } else if (ss.is_credited) {
        plannedStatus = 'credited';
      }
    } else if (isUnplanned) {
      // Unplanned student (attended but not in sessions_students)
      plannedStatus = 'unplanned';
    } else if (ss.is_extra && plannedStudentIds.has(ss.student_id)) {
      // Planned extra student (in sessions_students but marked as extra)
      plannedStatus = 'attending-extra';
    }
    
    const actualAttendance = actualStudentAttendance[ss.student_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    return {
      student: ss.student,
      plannedStatus,
      actualStatus,
      rescheduledDate,
      rescheduledSessionId: ss.rescheduled_session?.session?.id,
      invoiceStatus: ss.invoice_status || null,
      plannedAbsence: ss.planned_absence || false,
      hasInvoiceItems: !!ss.invoice_status, // If invoice_status exists, invoice_items exist
    };
  });

  // Process staff
  const staffData = sessionsStaff.map((sf: any) => {
    let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';
    let swappedStaffName = '';
    let swappedStaffId = '';
    
    if (sf.planned_absence) {
      plannedStatus = 'absent';
      if (sf.is_swapped && sf.swapped_staff) {
        plannedStatus = 'swapped';
        swappedStaffName = `${sf.swapped_staff.first_name} ${sf.swapped_staff.last_name}`;
        swappedStaffId = sf.swapped_staff.id;
      }
    }
    
    const actualAttendance = actualStaffAttendance[sf.staff_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    const submittedTutorLog = tutorLog?.created_by === sf.staff_id;
    
    return {
      staff: sf.staff,
      plannedStatus,
      actualStatus,
      staffType: actualAttendance?.type,
      swappedStaffName,
      swappedStaffId,
      submittedTutorLog,
      plannedAbsence: sf.planned_absence || false,
    };
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            {/* Sticky Header */}
            <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
              <SheetHeader className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <SheetTitle>Session Details</SheetTitle>
                    <SheetDescription className="text-lg font-medium">
                      {sessionTitle}
                    </SheetDescription>
                  </div>
                  {sessionId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        router.push(`/sessions/${sessionId}`);
                        onClose();
                      }}
                      className="shrink-0"
                      title="Open in new page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="px-6 pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 relative">
              <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
                  <SessionDetailsTab
                    session={session}
                    studentsData={studentsData}
                    staffData={staffData}
                    tutorLog={tutorLog}
                    allTopics={allTopics}
                    sessionId={sessionId}
                    isSessionInPast={isSessionInPast}
                    currentStaff={currentStaff || null}
                    onOpenSession={handleOpenSession}
                    onOpenStudent={(studentId) => {
                      setSelectedStudentId(studentId);
                      setIsStudentModalOpen(true);
                    }}
                    onOpenStaff={handleOpenStaff}
                    onMessageStudent={handleMessageStudent}
                    onMessageStaff={handleMessageStaff}
                    onOpenTopic={handleOpenTopic}
                    onOpenFile={handleOpenFile}
                    onLogAbsenceStudent={(studentId) => {
                      setSelectedStudentForAbsence(studentId);
                      setIsLogStudentAbsenceDialogOpen(true);
                    }}
                    onLogAbsenceStaff={(staffId) => {
                      setSelectedStaffForAbsence(staffId);
                      setIsLogStaffAbsenceDialogOpen(true);
                    }}
                    onSendBookingConfirmation={(studentId) => {
                      setSelectedStudentForBookingConfirmation(studentId);
                      setIsBookingConfirmationDialogOpen(true);
                    }}
                    onLogSession={() => {
                      setIsLogSessionModalOpen(true);
                    }}
                  />
                  <Separator className="my-6" />
                  {/* Session Files Section - Only show for meetings, not classes */}
                  {sessionId && session.type !== 'CLASS' && (
                    <SessionFiles sessionId={sessionId} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
                  {sessionId && (
                    <SessionActivityTab sessionId={sessionId} isOpen={isOpen} />
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
      
      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          staffId={selectedStaffId}
          onStaffUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={async () => {
            setIsLogSessionModalOpen(false);
            // Refresh session data after logging
            if (sessionId && isOpen) {
              try {
                const result = await sessionsApi.getSessionWithTutorLog(sessionId);
                setData(result);
              } catch (error) {
                console.error('Failed to refresh session data:', error);
              }
            }
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={sessionId || undefined}
          initialStaffId={getFirstStaffForLogging()}
        />
      )}

      {/* Booking Confirmation Dialog */}
      {selectedStudentForBookingConfirmation && sessionId && (
        <SendBookingConfirmationDialog
          isOpen={isBookingConfirmationDialogOpen}
          onClose={() => {
            setIsBookingConfirmationDialogOpen(false);
            setSelectedStudentForBookingConfirmation(null);
          }}
          sessionId={sessionId}
          studentId={selectedStudentForBookingConfirmation}
        />
      )}

      {/* Log Student Absence Dialog */}
      {selectedStudentForAbsence && sessionId && currentStaff && (
        <LogAbsenceDialog
          isOpen={isLogStudentAbsenceDialogOpen}
          onClose={async () => {
            setIsLogStudentAbsenceDialogOpen(false);
            setSelectedStudentForAbsence(null);
            // Refresh session data after logging absence
            if (sessionId && isOpen) {
              try {
                const result = await sessionsApi.getSessionWithTutorLog(sessionId);
                setData(result);
              } catch (error) {
                console.error('Failed to refresh session data:', error);
              }
            }
          }}
          staffId={currentStaff.id}
          initialStudentId={selectedStudentForAbsence}
          initialSessionId={sessionId}
        />
      )}

      {/* Log Staff Absence Dialog */}
      {selectedStaffForAbsence && sessionId && currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={isLogStaffAbsenceDialogOpen}
          onClose={async () => {
            setIsLogStaffAbsenceDialogOpen(false);
            setSelectedStaffForAbsence(null);
            // Refresh session data after logging absence
            if (sessionId && isOpen) {
              try {
                const result = await sessionsApi.getSessionWithTutorLog(sessionId);
                setData(result);
              } catch (error) {
                console.error('Failed to refresh session data:', error);
              }
            }
          }}
          staffId={currentStaff.id}
          initialStaffId={selectedStaffForAbsence}
          initialSessionId={sessionId}
        />
      )}

    </>
  );
}
