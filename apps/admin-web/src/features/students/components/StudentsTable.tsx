'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminUrlSync } from '@/shared/hooks/useAdminUrlSync';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  SkeletonTable,
  Label,
  Input,
  useToast,
  DataTableToolbar,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  TablePagination,
} from "@altitutor/ui";
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { ONLINE_PRODUCT_NAMES } from '@altitutor/shared';
import { onlineProductSummary } from '../lib/onlineProducts';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { getSubjectCurriculumColor } from '@/shared/utils';
import { AddStudentModal } from './AddStudentModal';
import { ViewParentModal } from './ViewParentModal';
import { ViewClassModal } from '@/features/classes';
import { useStudentDirectory } from '../hooks/useStudentDirectory';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';
import { StudentDirectoryBoard, studentGroupOptions, studentGroup } from './StudentDirectoryBoard';
import type { StudentDirectoryEntry } from '../types/directory';
import { JourneyDetail } from '@/features/onboarding/components/JourneyDetail';
import { defaultDeadlines, stages } from '@/features/onboarding/lib/model';
import { useSubjects } from '@/features/subjects';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { LogAbsenceDialog } from '@/features/sessions/components';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import { SendStudentInviteDialog } from './SendStudentInviteDialog';
import { StudentExitRequestDialog } from '@/features/forms/components/StudentExitRequestDialog';
import { DiscontinueStudentConfirmDialog } from './DiscontinueStudentConfirmDialog';
import { ReEnrollStudentConfirmDialog } from './ReEnrollStudentConfirmDialog';
import { studentsApi } from '../api';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useStudentViews, STUDENT_FILTER_KEYS, STUDENT_VIEW_DEFAULTS } from '../hooks/useStudentViews';
import { useStudentActions } from '../hooks/useStudentActions';
import { InPersonStatusBadge } from './InPersonStatusBadge';
import type { StudentSearchField } from '../api/students';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

interface StudentRowActionsProps {
  student: Tables<'students'>;
  onOpenInPage: () => void;
  onEditDetails: () => void;
  onPasswordResetOrRegistration: () => void;
  passwordResetLabel: string;
  onLogAbsence: () => void;
  onBookTrialSession: () => void;
  onBookDraftingSession: () => void;
  onBookSubsidyInterview: () => void;
  onBookCheckIn: () => void;
  onSendDiscontinuationLink?: () => void;
  onDiscontinue?: () => void;
  onReEnroll?: () => void;
  onDelete: () => void;
}

function StudentRowActions({
  student,
  onOpenInPage,
  onEditDetails,
  onPasswordResetOrRegistration,
  passwordResetLabel,
  onLogAbsence,
  onBookTrialSession,
  onBookDraftingSession,
  onBookSubsidyInterview,
  onBookCheckIn,
  onSendDiscontinuationLink,
  onDiscontinue,
  onReEnroll,
  onDelete,
}: StudentRowActionsProps) {
  const studentActions = useStudentActions({
    studentId: student.id,
    student,
    onOpenInPage,
    onEditDetails,
    onPasswordResetOrRegistration,
    passwordResetLabel,
    onLogAbsence,
    onBookTrialSession,
    onBookDraftingSession,
    onBookSubsidyInterview,
    onBookCheckIn,
    onSendDiscontinuationLink,
    onDiscontinue,
    onReEnroll,
    onDelete,
  });

  return (
    <ActionsMenu
      type="student"
      entityId={student.id}
      copyTagDisplayText={`${student.first_name || ''} ${student.last_name || ''}`.trim()}
      {...studentActions}
    />
  );
}

export function StudentsTable({ onRefresh: _onRefresh, onStudentSelect: _onStudentSelect, addModalState: _addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  useAdminUrlSync();
  const { data: currentStaff } = useCurrentStaff();
  const { data: allSubjects = [] } = useSubjects();
  const { toast } = useToast();
  const { openCheckInModal } = useQuickActions();
  const [searchFields, setSearchFields] = useState<StudentSearchField[]>(['name', 'email', 'phone']);

  const defaultFilters = useMemo(() => STUDENT_VIEW_DEFAULTS.in_person.filters, []);
  const defaultSort = useMemo(() => ({ field: STUDENT_VIEW_DEFAULTS.in_person.sortBy, direction: STUDENT_VIEW_DEFAULTS.in_person.sortDirection }), []);
  const defaultVisibleColumns = STUDENT_VIEW_DEFAULTS.in_person.visibleColumns;

  const quickFilters = useStudentViews();

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    setGroupBy,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: STUDENT_FILTER_KEYS,
  });

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStudentDirectory({
    search: state.search, searchFields, filters: state.filters,
    page: state.page, pageSize: state.pageSize,
    sortBy: state.sortBy, sortDirection: state.sortDirection, groupBy: state.groupBy,
  });
  const [view, setView] = useAdminPageViewParam(['list', 'board', 'worklist'] as const, 'list');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>();
  const selectedJourney = data?.entries.find(entry => entry.journey?.id === selectedJourneyId)?.journey;
  const openEntry = (entry: StudentDirectoryEntry) => entry.kind === 'student'
    ? router.push(`/students/${entry.student.id}`) : setSelectedJourneyId(entry.journey?.id);


  const total = data?.total || 0;

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  // Actions menu states
  const [actionStudentId, setActionStudentId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isBookTrialSessionModalOpen, setIsBookTrialSessionModalOpen] = useState(false);
  const [isBookDraftingSessionModalOpen, setIsBookDraftingSessionModalOpen] = useState(false);
  const [isBookSubsidyInterviewModalOpen, setIsBookSubsidyInterviewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  const [, setLoadingPasswordReset] = useState(false);
  const [, setHasPasswordResetLinkSent] = useState(false);
  const [studentToDiscontinue, setStudentToDiscontinue] = useState<{ id: string; first_name?: string; last_name?: string; phone?: string | null } | null>(null);
  const [studentForDiscontinuationLink, setStudentForDiscontinuationLink] = useState<{ id: string; first_name?: string; last_name?: string; phone?: string | null } | null>(null);
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  const [studentToReEnroll, setStudentToReEnroll] = useState<{ id: string; first_name?: string; last_name?: string } | null>(null);
  const [isReEnrolling, setIsReEnrolling] = useState(false);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    { key: 'relationship', label: 'Relationship', options: [{ value: 'in_person', label: 'In person' }, { value: 'online', label: 'Online' }, { value: 'trial', label: 'Trial / onboarding' }] },
    { key: 'product', label: 'Product', options: [{ value: 'UCAT_WEB', label: ONLINE_PRODUCT_NAMES.UCAT_WEB }, { value: 'STUDENT_WEB', label: ONLINE_PRODUCT_NAMES.STUDENT_WEB }] },
    { key: 'entitlement', label: 'Tier', options: [{ value: 'FREE', label: 'Free' }, { value: 'PAID', label: 'Unlimited' }] },
    { key: 'accountClass', label: 'Account', options: [{ value: 'external', label: 'External' }, { value: 'internal_test', label: 'Internal test' }] },
    { key: 'onboardingStatus', label: 'Onboarding status', options: [...stages, 'No onboarding'].map(value => ({ value, label: value })) },
    { key: 'queue', label: 'Queue', options: [{ value: 'open', label: 'All open' }, { value: 'ours', label: 'Our action' }, { value: 'waiting', label: 'Waiting' }, { value: 'overdue', label: 'Overdue' }, { value: 'closed', label: 'Completed / closed' }] },
    {
      key: 'status',
      label: 'In-person status',
      options: [
        { label: 'ACTIVE', value: 'ACTIVE' },
        { label: 'TRIAL', value: 'TRIAL' },
        { label: 'DISCONTINUED', value: 'DISCONTINUED' },
      ],
    },
    {
      key: 'curriculum',
      label: 'Curriculum',
      options: ['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'].map(c => ({ label: c, value: c })),
    },
    {
      key: 'yearLevel',
      label: 'Year Level',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(y => ({ label: `Year ${y}`, value: y })),
    },
    {
      key: 'subject',
      label: 'Subjects',
      options: allSubjects
        .sort((a, b) => (a.long_name ?? '').localeCompare(b.long_name ?? ''))
        .map(s => ({ label: s.long_name ?? '', value: s.id })),
    },
    {
      key: 'inPersonClass',
      label: 'In person (classes)',
      options: [
        { label: 'Enrolled in a class', value: 'has' },
        { label: 'Not in any class', value: 'none' },
      ],
    },
  ], [allSubjects]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'status', label: 'Status' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'created_at', label: 'Created At' },
    { key: 'online_since', label: 'Online since' },
    { key: 'stage', label: 'Onboarding status' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'status', label: 'Status' },
    { key: 'education', label: 'Education' },
    { key: 'student', label: 'Student' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'school', label: 'School' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'parents', label: 'Parents' },
    { key: 'classes', label: 'Classes' },
    { key: 'products', label: 'Products' },
    { key: 'online_since', label: 'Online since' },
    { key: 'onboarding_status', label: 'Onboarding status' },
  ];

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
  const filteredStudents = useMemo(() => entries.flatMap(entry => entry.kind === 'student' ? [entry.student] : []), [entries]);
  // Non-virtualized table for stability (virtualization can be re-enabled later)
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (_onRefresh) {
      refetch();
    }
  }, [_onRefresh, refetch]);

  const handleStudentClick = (id: string) => {
    router.push(`/students/${id}`);
  };

  const handleStudentUpdated = () => {
    refetch();
  };

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleParentClick = (parentId: string) => {
    setSelectedParentId(parentId);
    setIsParentModalOpen(true);
  };

  // Actions menu handlers
  const handlePasswordResetOrRegistration = (student: Tables<'students'>) => {
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;

    if (hasAccount) {
      handlePasswordResetRequest(student);
    } else if (isRegistered) {
      setInviteDialogType('invite');
      setInviteDialogOpen(true);
    } else {
      setInviteDialogType('registration');
      setInviteDialogOpen(true);
    }
  };

  const getPasswordResetLabel = (student: Tables<'students'>) => {
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;

    if (hasAccount) {
      return 'Send password reset';
    } else if (isRegistered) {
      return 'Send invite';
    } else {
      return 'Send registration link';
    }
  };

  const handlePasswordResetRequest = async (student: Tables<'students'>) => {
    if (!student.email) {
      toast({
        title: "Error",
        description: "No email address found for this student.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingPasswordReset(true);
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-email',
          userId: student.user_id,
          email: student.email,
          userType: 'student',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Failed to send password reset link');
      }

      setHasPasswordResetLinkSent(true);
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPasswordReset(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      setIsDeleting(true);
      await studentsApi.deleteStudent(studentId);
      setIsDeleteDialogOpen(false);
      setActionStudentId(null);
      setDeleteConfirmText('');
      handleStudentUpdated();
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
        <div className="text-sm text-muted-foreground">
          Loading students...
        </div>
      </div>
    );
  }

  // Error state
  if (error && entries.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load students. Please try again.
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="ml-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={setGroupBy}
        groupByOptions={studentGroupOptions}
        view={{ value: view === 'worklist' ? 'list' : view, options: [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }], onChange: value => { if (value === 'list' || value === 'board') setView(value); } }}
        className="px-6 pt-6 pb-2"
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters} viewTarget="students"
        searchPlaceholder="Search name, email or phone..."
        searchFromOptions={[
          { label: 'Name', value: 'name' },
          { label: 'Email', value: 'email' },
          { label: 'Phone', value: 'phone' },
        ]}
        searchFromValue={searchFields}
        onSearchFromChange={(values) => setSearchFields(values as StudentSearchField[])}
        isLoading={isFetching}
      />

      {view === 'board' ? <StudentDirectoryBoard entries={entries} groupBy={state.groupBy} columns={state.visibleColumns} open={openEntry} /> : <div className="min-h-0 flex-1 overflow-auto px-6 pt-2" ref={parentRef}><div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('status') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('status', state.sortBy === 'status' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Status
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'status' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('education') && (
                <TableHead>
                  Education
                </TableHead>
              )}
              {state.visibleColumns.includes('student') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('last_name', state.sortBy === 'last_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Student
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'last_name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('email') && (
                <TableHead>
                  Email
                </TableHead>
              )}
              {state.visibleColumns.includes('phone') && (
                <TableHead>
                  Phone
                </TableHead>
              )}
              {state.visibleColumns.includes('school') && (
                <TableHead>
                  School
                </TableHead>
              )}
              {state.visibleColumns.includes('subjects') && <TableHead>Subjects</TableHead>}
              {state.visibleColumns.includes('parents') && <TableHead>Parents</TableHead>}
              {state.visibleColumns.includes('classes') && <TableHead>Classes</TableHead>}
              {state.visibleColumns.includes('products') && <TableHead>Products</TableHead>}
              {state.visibleColumns.includes('online_since') && <TableHead>Online since</TableHead>}
              {state.visibleColumns.includes('onboarding_status') && <TableHead>Onboarding status</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {isLoading ? (
                    "Loading students..."
                  ) : state.search || Object.keys(state.filters).length > 0 ? (
                    "No students match your filters"
                  ) : (
                    "No students found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry, index) => {
                const heading = state.groupBy && (index === 0 || studentGroup(entries[index - 1], state.groupBy) !== studentGroup(entry, state.groupBy)) ? <TableRow><TableCell colSpan={state.visibleColumns.length + 1} className="bg-muted/30 font-semibold">{studentGroup(entry, state.groupBy)}</TableCell></TableRow> : null;
                if (entry.kind === 'enquiry') return <React.Fragment key={entry.id}>{heading}<TableRow key={entry.id} className="cursor-pointer" onClick={() => openEntry(entry)}>{columnDefinitions.filter(column => state.visibleColumns.includes(column.key)).map(({ key: column }) => <TableCell key={column}>{column === 'student' ? entry.label : column === 'onboarding_status' ? entry.stage : column === 'subjects' ? entry.journey?.evidence.subjects.map(subject => subject.name).join(' · ') : '—'}</TableCell>)}<TableCell /></TableRow></React.Fragment>;
                const student = entry.student;
                const studentWithClasses = student as Tables<'students'> & {
                  classes?: Array<{ id: string; short_name: string | null; long_name: string | null; day_of_week: number | null; start_time: string | null; level: string | null; subject?: Tables<'subjects'> | null }>;
                  subjects?: Tables<'subjects'>[];
                  parents?: Tables<'parents'>[];
                };
                const classes = studentWithClasses.classes || [];
                const subjects = studentWithClasses.subjects || [];
                const parents = studentWithClasses.parents || [];
                return (
                  <React.Fragment key={entry.id}>
                  {heading}
                  <TableRow
                    data-index={index}
                    className="cursor-pointer"
                    onClick={() => handleStudentClick(student.id)}
                  >
                    {state.visibleColumns.includes('status') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1 items-center">
                          <InPersonStatusBadge status={student.status} className="text-xs" />
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('education') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1 items-center">
                          {student.curriculum ? (
                            <Badge className={cn("text-xs", getSubjectCurriculumColor(student.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE'))}>
                              {student.curriculum}
                            </Badge>
                          ) : null}
                          {student.year_level ? (
                            <Badge variant="outline" className="text-xs bg-transparent">
                              Year {student.year_level}
                            </Badge>
                          ) : null}
                          {!student.curriculum && !student.year_level && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('student') && (
                      <TableCell>
                        <div className="font-medium">
                          {`${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unnamed Student'}
                        </div>
                        {(student.email || student.phone) ? (
                          <div className="text-xs text-muted-foreground">
                            {[student.email, student.phone].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('email') && (
                      <TableCell className="whitespace-nowrap text-sm">
                        {student.email || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('phone') && (
                      <TableCell className="whitespace-nowrap text-sm">
                        {student.phone || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('school') && (
                      <TableCell className="min-w-48 text-sm">
                        {student.school || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('subjects') && (
                      <TableCell className="min-w-48">
                        {subjects.length > 0 ? (
                          <div className="flex flex-col gap-1 text-xs">
                            {subjects.map((subject) => (
                              <span key={subject.id} className="whitespace-nowrap">
                                {subject.long_name || subject.short_name || subject.name || subject.id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No subjects</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('parents') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {parents.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {parents.map((parent) => (
                              <Button
                                key={parent.id}
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleParentClick(parent.id);
                                }}
                              >
                                {`${parent.first_name || ''} ${parent.last_name || ''}`.trim() || 'Parent'}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No parents</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('classes') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {classes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {classes
                              .sort((a, b) => {
                                const aDay = a.day_of_week ?? 0;
                                const bDay = b.day_of_week ?? 0;
                                if (aDay !== bDay) return aDay - bDay;
                                const aTime = a.start_time ?? '';
                                const bTime = b.start_time ?? '';
                                return aTime.localeCompare(bTime);
                              })
                              .map((cls) => {
                                const shortName = cls.short_name?.trim() ?? cls.long_name?.trim() ?? '';
                                const displayName = shortName || `Class ${cls.id.slice(0, 8)}`;
                                return (
                                  <Button
                                    key={cls.id}
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClassClick(cls.id);
                                    }}
                                    title={cls.long_name ?? shortName}
                                  >
                                    {displayName}
                                  </Button>
                                );
                              })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No classes</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('products') && <TableCell><div className="flex flex-wrap gap-1">{entry.products.map(product => <Badge key={product.product} variant="secondary">{onlineProductSummary(product)}</Badge>)}</div></TableCell>}
                    {state.visibleColumns.includes('online_since') && <TableCell>{entry.online_since ? new Date(entry.online_since).toLocaleDateString('en-AU') : '—'}</TableCell>}
                    {state.visibleColumns.includes('onboarding_status') && <TableCell>{entry.stage ?? 'No onboarding'}</TableCell>}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StudentRowActions
                        student={student}
                        onOpenInPage={() => {
                          router.push(`/students/${student.id}`);
                        }}
                        onEditDetails={() => {
                          handleStudentClick(student.id);
                        }}
                        onPasswordResetOrRegistration={() => {
                          setActionStudentId(student.id);
                          handlePasswordResetOrRegistration(student);
                        }}
                        passwordResetLabel={getPasswordResetLabel(student)}
                        onLogAbsence={() => {
                          setActionStudentId(student.id);
                          setIsLogAbsenceDialogOpen(true);
                        }}
                        onBookTrialSession={() => {
                          setActionStudentId(student.id);
                          setIsBookTrialSessionModalOpen(true);
                        }}
                        onBookDraftingSession={() => {
                          setActionStudentId(student.id);
                          setIsBookDraftingSessionModalOpen(true);
                        }}
                        onBookSubsidyInterview={() => {
                          setActionStudentId(student.id);
                          setIsBookSubsidyInterviewModalOpen(true);
                        }}
                        onBookCheckIn={() =>
                          openCheckInModal({
                            students: [
                              {
                                id: student.id,
                                first_name: student.first_name,
                                last_name: student.last_name,
                              },
                            ],
                          })
                        }
                        onSendDiscontinuationLink={() => {
                          setStudentForDiscontinuationLink(student);
                        }}
                        onDiscontinue={() => {
                          setStudentToDiscontinue(student);
                        }}
                        onReEnroll={() => {
                          setStudentToReEnroll(student);
                        }}
                        onDelete={() => {
                          setActionStudentId(student.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      />
                    </TableCell>
                  </TableRow></React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div></div>}

      <div className="shrink-0 px-6 py-3"><TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      /></div>
      {selectedJourney && <JourneyDetail key={selectedJourney.id} journey={selectedJourney} deadlines={data?.deadlines ?? defaultDeadlines} onClose={() => setSelectedJourneyId(undefined)} />}

      {/* Modals ... */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentUpdated}
      />



      {selectedClassId && (
        <ViewClassModal
          classId={selectedClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={handleStudentUpdated}
        />
      )}

      {selectedParentId && (
        <ViewParentModal
          isOpen={isParentModalOpen}
          onClose={() => {
            setIsParentModalOpen(false);
            setSelectedParentId(null);
          }}
          parentId={selectedParentId}
          onParentUpdated={handleStudentUpdated}
        />
      )}

      {currentStaff && actionStudentId && (
        <LogAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={() => {
            setIsLogAbsenceDialogOpen(false);
            setActionStudentId(null);
          }}
          staffId={currentStaff.id}
          initialStudentId={actionStudentId}
          allowPastSessions={true}
        />
      )}

      {actionStudentId && (
        <BookSessionModal
          isOpen={isBookTrialSessionModalOpen}
          onClose={() => {
            setIsBookTrialSessionModalOpen(false);
            setActionStudentId(null);
          }}
          sessionType="TRIAL_SESSION"
          initialStudentId={actionStudentId}
          onBookingCreated={() => {
            setIsBookTrialSessionModalOpen(false);
            setActionStudentId(null);
            handleStudentUpdated();
          }}
        />
      )}

      {actionStudentId && (
        <BookSessionModal
          isOpen={isBookDraftingSessionModalOpen}
          onClose={() => {
            setIsBookDraftingSessionModalOpen(false);
            setActionStudentId(null);
          }}
          sessionType="DRAFTING"
          initialStudentId={actionStudentId}
          onBookingCreated={() => {
            setIsBookDraftingSessionModalOpen(false);
            setActionStudentId(null);
            handleStudentUpdated();
          }}
        />
      )}

      {actionStudentId && (
        <BookSessionModal
          isOpen={isBookSubsidyInterviewModalOpen}
          onClose={() => {
            setIsBookSubsidyInterviewModalOpen(false);
            setActionStudentId(null);
          }}
          sessionType="SUBSIDY_INTERVIEW"
          initialStudentId={actionStudentId}
          onBookingCreated={() => {
            setIsBookSubsidyInterviewModalOpen(false);
            setActionStudentId(null);
            handleStudentUpdated();
          }}
        />
      )}

      {actionStudentId && filteredStudents.find(s => s.id === actionStudentId) && (
        <SendStudentInviteDialog
          isOpen={inviteDialogOpen}
          onClose={() => {
            setInviteDialogOpen(false);
            setActionStudentId(null);
          }}
          student={filteredStudents.find(s => s.id === actionStudentId)!}
          linkType={inviteDialogType}
        />
      )}

      {actionStudentId && filteredStudents.find(s => s.id === actionStudentId) && (() => {
        const studentToDelete = filteredStudents.find(s => s.id === actionStudentId)!;
        const studentFullName = `${studentToDelete.first_name} ${studentToDelete.last_name}`;
        return (
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setDeleteConfirmText('');
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will hide the Student
                  "{studentFullName}" and block their access while retaining all history. Resolve active enrolments, future bookings, subscriptions and open checkouts first. Their existing login or an AdminStaff restore can make the record available again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <div className="space-y-2">
                  <Label>
                    Type <strong>{studentFullName}</strong> to confirm deletion
                  </Label>
                  <Input
                    type="text"
                    placeholder={studentFullName}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (actionStudentId) {
                      handleDeleteStudent(actionStudentId);
                      setDeleteConfirmText('');
                    }
                  }}
                  disabled={isDeleting || deleteConfirmText !== studentFullName}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {studentForDiscontinuationLink && (
        <StudentExitRequestDialog
          open={!!studentForDiscontinuationLink}
          onOpenChange={(open) => {
            if (!open) setStudentForDiscontinuationLink(null);
          }}
          studentId={studentForDiscontinuationLink.id}
          studentName={[studentForDiscontinuationLink.first_name, studentForDiscontinuationLink.last_name].filter(Boolean).join(' ') || 'this student'}
          studentPhone={studentForDiscontinuationLink.phone}
          workflowKey="student_discontinuation"
          onCreated={refetch}
        />
      )}

      {studentToDiscontinue && (
        <DiscontinueStudentConfirmDialog
          isOpen={!!studentToDiscontinue}
          onOpenChange={(open) => {
            if (!open) setStudentToDiscontinue(null);
          }}
          studentName={[studentToDiscontinue.first_name, studentToDiscontinue.last_name].filter(Boolean).join(' ') || 'this student'}
          isDiscontinuing={isDiscontinuing}
          onConfirm={async () => {
            if (!currentStaff) return false;

            try {
              setIsDiscontinuing(true);
              const result = await studentsApi.discontinueStudent(studentToDiscontinue.id, currentStaff.id);
              if (!result.success) throw new Error(result.error);
              toast({
                title: 'Success',
                description: 'Student discontinued successfully.',
              });
              await refetch();
              return true;
            } catch (error) {
              toast({
                title: 'Discontinue failed',
                description: error instanceof Error ? error.message : 'There was an error discontinuing the student. Please try again.',
                variant: 'destructive',
              });
              return false;
            } finally {
              setIsDiscontinuing(false);
            }
          }}
        />
      )}

      {studentToReEnroll && (
        <ReEnrollStudentConfirmDialog
          isOpen={!!studentToReEnroll}
          onOpenChange={(open) => {
            if (!open) setStudentToReEnroll(null);
          }}
          studentName={[studentToReEnroll.first_name, studentToReEnroll.last_name].filter(Boolean).join(' ') || 'this student'}
          isReEnrolling={isReEnrolling}
          onConfirm={async () => {
            try {
              setIsReEnrolling(true);
              await studentsApi.reEnrollStudent(studentToReEnroll.id);
              toast({
                title: 'Success',
                description: 'Student re-enrolled successfully.',
              });
              handleStudentUpdated();
              return true;
            } catch (error) {
              toast({
                title: 'Re-enroll failed',
                description: error instanceof Error ? error.message : 'There was an error re-enrolling the student. Please try again.',
                variant: 'destructive',
              });
              return false;
            } finally {
              setIsReEnrolling(false);
            }
          }}
        />
      )}
    </div>
  );
}
