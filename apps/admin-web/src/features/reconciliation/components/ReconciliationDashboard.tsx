'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  UninvoicedSessionsTable,
  UnpaidInvoicesTable,
  UnloggedSessionsTable,
  UnassignedClassesTable,
  UnreadMessagesTable,
  StudentsWithoutClassesTable,
} from './ReconciliationTable';
import {
  useUninvoicedSessions,
  useUnpaidInvoices,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnreadMessages,
  useStudentsWithoutClasses,
} from '../api/queries';
import { ViewStudentModal } from '@/features/students';
import { LogSessionModal } from '@/features/tutor-logs';
import { ViewInvoiceModal } from '@/features/billing';
import { SessionModal } from '@/features/sessions';
import { ViewClassModal } from '@/features/classes';
import { AssignStaffModal, EnrollStudentModal } from '@/features/enrollments';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useQueryClient } from '@tanstack/react-query';
import { reconciliationKeys } from '../api/queryKeys';
import { ReconciliationHandlersProvider } from './ReconciliationActions';
import { useClassDetails } from '@/features/classes/hooks/useClassesQuery';
import { classesApi } from '@/features/classes/api';
import { useStudentWithSubjects } from '@/features/students/hooks/useStudentsQuery';
import { useStudentClasses } from '@/features/students/hooks/useStudentClasses';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassWithExpandedSubject } from '@altitutor/shared';
import { useCallback } from 'react';

export function ReconciliationDashboard() {
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionInitialSessionId, setLogSessionInitialSessionId] = useState<string | undefined>();
  const [logSessionInitialStaffId, setLogSessionInitialStaffId] = useState<string | undefined>();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  const [assignStaffClassId, setAssignStaffClassId] = useState<string | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollModalStudentId, setEnrollModalStudentId] = useState<string | null>(null);
  const [enrollModalSubjectId, setEnrollModalSubjectId] = useState<string | null>(null);

  // Fetch all reconciliation data
  const uninvoicedSessions = useUninvoicedSessions();
  const unpaidInvoices = useUnpaidInvoices();
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const unreadMessages = useUnreadMessages();
  const studentsWithoutClasses = useStudentsWithoutClasses();

  // Check if any query is loading
  const isLoading =
    uninvoicedSessions.isLoading ||
    unpaidInvoices.isLoading ||
    unloggedSessions.isLoading ||
    unassignedClasses.isLoading ||
    unreadMessages.isLoading ||
    studentsWithoutClasses.isLoading;

  // Check if any query has error
  const hasError =
    uninvoicedSessions.isError ||
    unpaidInvoices.isError ||
    unloggedSessions.isError ||
    unassignedClasses.isError ||
    unreadMessages.isError ||
    studentsWithoutClasses.isError;

  // Handlers for opening modals
  const handleOpenStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  const handleLogSession = (sessionId: string, staffId?: string) => {
    setLogSessionInitialSessionId(sessionId);
    setLogSessionInitialStaffId(staffId);
    setIsLogSessionModalOpen(true);
  };

  const handleOpenInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleOpenClass = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleAssignStaff = (classId: string) => {
    setAssignStaffClassId(classId);
    setIsAssignStaffModalOpen(true);
  };

  const handleAddClass = (studentId: string, subjectId: string) => {
    setEnrollModalStudentId(studentId);
    setEnrollModalSubjectId(subjectId);
    setIsEnrollModalOpen(true);
  };

  const handleCloseLogSessionModal = async () => {
    setIsLogSessionModalOpen(false);
    setLogSessionInitialSessionId(undefined);
    setLogSessionInitialStaffId(undefined);
    // Refresh unlogged sessions after logging
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.unloggedSessions() });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading reconciliation data. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const financialItems = [
    ...(uninvoicedSessions.data ?? []),
    ...(unpaidInvoices.data ?? []),
  ];
  const schedulingItems = [
    ...(unloggedSessions.data ?? []),
    ...(unassignedClasses.data ?? []),
    ...(studentsWithoutClasses.data ?? []),
  ];
  const communicationItems = unreadMessages.data ?? [];

  return (
    <ReconciliationHandlersProvider
      handlers={{
        onOpenStudent: handleOpenStudent,
        onLogSession: handleLogSession,
        onOpenInvoice: handleOpenInvoice,
        onOpenSession: handleOpenSession,
        onOpenClass: handleOpenClass,
        onAssignStaff: handleAssignStaff,
        onAddClass: handleAddClass,
      }}
    >
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Identify and resolve data inconsistencies across scheduling, communication, and financial domains
          </p>
        </div>

        {/* Financial Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Financial</h2>
          <UninvoicedSessionsTable
            items={uninvoicedSessions.data ?? []}
            isLoading={uninvoicedSessions.isLoading}
          />
          <UnpaidInvoicesTable
            items={unpaidInvoices.data ?? []}
            isLoading={unpaidInvoices.isLoading}
          />
        </div>

        {/* Scheduling Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Scheduling</h2>
          <UnloggedSessionsTable
            items={unloggedSessions.data ?? []}
            isLoading={unloggedSessions.isLoading}
          />
          <UnassignedClassesTable
            items={unassignedClasses.data ?? []}
            isLoading={unassignedClasses.isLoading}
          />
          <StudentsWithoutClassesTable
            items={studentsWithoutClasses.data ?? []}
            isLoading={studentsWithoutClasses.isLoading}
          />
        </div>

        {/* Communication Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Communication</h2>
          <UnreadMessagesTable
            items={unreadMessages.data ?? []}
            isLoading={unreadMessages.isLoading}
          />
        </div>

        {/* Empty state */}
        {!isLoading && financialItems.length === 0 && schedulingItems.length === 0 && communicationItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="text-sm mt-2">All data is consistent!</p>
          </div>
        )}

        {/* Student Modal */}
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Refresh reconciliation data
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {/* Log Session Modal */}
        {currentStaff && (
          <LogSessionModal
            isOpen={isLogSessionModalOpen}
            onClose={handleCloseLogSessionModal}
            currentStaffId={currentStaff.id}
            adminMode={true}
            initialSessionId={logSessionInitialSessionId}
            initialStaffId={logSessionInitialStaffId}
          />
        )}

        {/* Invoice Modal */}
        <ViewInvoiceModal
          isOpen={isInvoiceModalOpen}
          invoiceId={selectedInvoiceId}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceId(null);
          }}
        />

        {/* Session Modal */}
        <SessionModal
          isOpen={isSessionModalOpen}
          sessionId={selectedSessionId}
          onClose={() => {
            setIsSessionModalOpen(false);
            setSelectedSessionId(null);
          }}
        />

        {/* Class Modal */}
        <ViewClassModal
          isOpen={isClassModalOpen}
          classId={selectedClassId}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={() => {
            // Refresh reconciliation data
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {/* Assign Staff Modal */}
        {currentStaff && assignStaffClassId && (
          <AssignStaffModalWrapper
            isOpen={isAssignStaffModalOpen}
            classId={assignStaffClassId}
            currentStaffId={currentStaff.id}
            onClose={() => {
              setIsAssignStaffModalOpen(false);
              setAssignStaffClassId(null);
            }}
            onAssign={async (params) => {
              await classesApi.assignStaff(params.classId, params.staffId, params.currentStaffId);
              queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
            }}
          />
        )}

        {/* Enroll Student Modal */}
        {currentStaff && enrollModalStudentId && (
          <EnrollStudentModalWrapper
            isOpen={isEnrollModalOpen}
            studentId={enrollModalStudentId}
            subjectId={enrollModalSubjectId}
            currentStaffId={currentStaff.id}
            onClose={() => {
              setIsEnrollModalOpen(false);
              setEnrollModalStudentId(null);
              setEnrollModalSubjectId(null);
            }}
            onEnroll={async (params) => {
              await classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
              queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
            }}
          />
        )}
      </div>
    </ReconciliationHandlersProvider>
  );
}

// Wrapper component to handle class data fetching for AssignStaffModal
function AssignStaffModalWrapper({
  isOpen,
  classId,
  currentStaffId,
  onClose,
  onAssign,
}: {
  isOpen: boolean;
  classId: string;
  currentStaffId: string;
  onClose: () => void;
  onAssign: (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => Promise<void>;
}) {
  const { data: classDetails, isLoading } = useClassDetails(classId, isOpen && !!classId);
  const classData = classDetails?.class || null;
  const classSubject = classDetails?.subject || null;
  const classStaff = classDetails?.staff || [];

  // Don't render modal until data is loaded
  if (!isOpen || isLoading || !classData || !classSubject) {
    return null;
  }

  return (
    <AssignStaffModal
      isOpen={isOpen}
      onClose={onClose}
      context="class"
      classData={classData}
      classSubject={classSubject}
      classStaff={classStaff}
      assignedStaffIds={classStaff.map(s => s.id)}
      onAssign={onAssign}
      currentStaffId={currentStaffId}
    />
  );
}

// Wrapper component to handle student data fetching for EnrollStudentModal
function EnrollStudentModalWrapper({
  isOpen,
  studentId,
  subjectId,
  currentStaffId,
  onClose,
  onEnroll,
}: {
  isOpen: boolean;
  studentId: string;
  subjectId: string | null;
  currentStaffId: string;
  onClose: () => void;
  onEnroll: (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => Promise<void>;
}) {
  const { data: studentWithSubjects, isLoading: isLoadingStudent } = useStudentWithSubjects(studentId);
  const { data: studentClasses = [] } = useStudentClasses(studentId);
  
  const student = studentWithSubjects?.student || null;
  const studentSubjects = studentWithSubjects?.subjects || [];
  const enrolledClassIds = studentClasses.map(c => c.class.id);

  // Fetch classes for the subject
  const fetchClassesForSubject = useCallback(async (subjId: string): Promise<ClassWithExpandedSubject[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
      p_search: undefined,
      p_statuses: ['ACTIVE'],
      p_subject_ids: [subjId],
      p_include_relationships: true,
      p_limit: 10000,
      p_offset: 0,
      p_order_by: 'day_of_week',
      p_ascending: true,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) return [];
    
    interface RPCClass {
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      status: string;
      room: string | null;
      subject_id: string | null;
      level: string | null;
    }
    
    interface RPCSubject {
      id: string;
      name: string;
      curriculum: string | null;
      year_level: number | null;
    }
    
    interface RPCStaff {
      id: string;
      first_name: string;
      last_name: string;
      role: string;
      status: string;
    }
    
    interface RPCStudent {
      id: string;
      first_name: string;
      last_name: string;
      status: string;
    }
    
    const rpcData = rpcResult as unknown as { 
      classes: RPCClass[]; 
      classSubjects: Record<string, RPCSubject>; 
      classStudents: Record<string, RPCStudent[]>; 
      classStaff: Record<string, RPCStaff[]>; 
      total: number 
    };
    
    const rpcClasses = rpcData.classes || [];
    
    // Transform RPC response to match ClassWithExpandedSubject format
    return rpcClasses.map(c => ({
      id: c.id,
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time,
      status: c.status as 'ACTIVE' | 'INACTIVE',
      room: c.room,
      level: c.level,
      subject_id: c.subject_id,
      created_at: null,
      updated_at: null,
      created_by: null,
      session_start_date: null,
      session_end_date: null,
      subject: rpcData.classSubjects?.[c.id] as ClassWithExpandedSubject['subject'] | undefined,
      staff: (rpcData.classStaff?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role as 'ADMINSTAFF' | 'TUTOR',
        status: s.status as 'ACTIVE' | 'INACTIVE',
        email: null,
        phone_number: null,
        created_at: null,
        updated_at: null,
      })),
      students: (rpcData.classStudents?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status as 'ACTIVE' | 'CURRENT' | 'TRIAL' | 'INACTIVE',
        curriculum: null,
        year_level: null,
        school: null,
        email: null,
        phone: null,
        phone_number: null,
        created_at: null,
        updated_at: null,
      }))
    })) as unknown as ClassWithExpandedSubject[];
  }, []);

  // Don't render modal until data is loaded
  if (!isOpen || isLoadingStudent || !student) {
    return null;
  }

  return (
    <EnrollStudentModal
      isOpen={isOpen}
      onClose={onClose}
      context="student"
      student={student}
      studentSubjects={studentSubjects}
      enrolledClassIds={enrolledClassIds}
      onFetchClasses={subjectId ? () => fetchClassesForSubject(subjectId) : undefined}
      subjectId={subjectId || undefined}
      onEnroll={onEnroll}
      currentStaffId={currentStaffId}
    />
  );
}
