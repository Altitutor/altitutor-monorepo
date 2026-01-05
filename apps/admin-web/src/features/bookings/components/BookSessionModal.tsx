'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@altitutor/ui';
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { TimeSlotPicker } from './TimeSlotPicker';
import { StaffSelector } from './StaffSelector';
import { AdminTrialContactForm, type AdminTrialContactFormValues } from './AdminTrialContactForm';
import { BookingConfirmationCalendar } from './BookingConfirmationCalendar';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { studentsApi } from '@/features/students/api/students';
import { useCreateStudent } from '@/features/students/hooks/useStudentsQuery';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import type { UseFormReturn } from 'react-hook-form';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { useSessionDurationMinutes } from '../hooks/useBookingSettings';

export interface BookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  onBookingCreated?: (sessionId: string) => void;
}

export function BookSessionModal({
  isOpen,
  onClose,
  sessionType,
  onBookingCreated,
}: BookSessionModalProps) {
  const { toast } = useToast();
  const createBooking = useCreateBooking();
  const createStudent = useCreateStudent();
  const { data: durationMinutes = 60 } = useSessionDurationMinutes(sessionType);

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds: string[] } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [trialContactData, setTrialContactData] = useState<AdminTrialContactFormValues | null>(null);
  const [trialContactFormRef, setTrialContactFormRef] = useState<UseFormReturn<AdminTrialContactFormValues> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track form validity state for reactive updates
  const [trialFormValid, setTrialFormValid] = useState(false);

  // Search students - filter by status for drafting sessions (only active students)
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'search', studentSearch, sessionType],
    queryFn: async () => {
      // For drafting sessions, only show active students (status = 'ACTIVE')
      const statuses = sessionType === 'DRAFTING' ? (['ACTIVE'] as Tables<'students'>['status'][]) : undefined;
      const result = await studentsApi.searchStudents(studentSearch, statuses);
      return result;
    },
    enabled: isOpen && studentSearch.length >= 2,
  });

  // Get all subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAllSubjects(),
    enabled: isOpen,
  });

  // Get student's subjects if student selected
  const { data: studentSubjects } = useQuery({
    queryKey: ['student-subjects', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const supabase = (await import('@/shared/lib/supabase/client')).getSupabaseClient();
      const { data, error } = await supabase
        .from('students_subjects')
        .select('subject_details:subjects(*)')
        .eq('student_id', selectedStudentId);
      if (error) throw error;
      return (data || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: isOpen && !!selectedStudentId && sessionType === 'DRAFTING',
  });

  // Get sessions for calendar view (single day of selected slot)
  const sessionDate = useMemo(() => {
    if (!selectedSlot) return new Date();
    const date = new Date(selectedSlot.startAt);
    // Set to start of day
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedSlot]);

  const dayStart = useMemo(() => {
    return sessionDate;
  }, [sessionDate]);

  const dayEnd = useMemo(() => {
    const end = new Date(sessionDate);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [sessionDate]);

  const { data: sessionsData } = useSessionsWithDetails({
    rangeStart: format(dayStart, 'yyyy-MM-dd'),
    rangeEnd: format(dayEnd, 'yyyy-MM-dd'),
    includeInactive: false,
  });

  // Get selected staff data for new session preview
  const { data: selectedStaff } = useStaffById(selectedStaffId || '');

  // Get selected student data for new session preview
  const selectedStudent = useMemo(() => {
    if (selectedStudentId && studentsData) {
      return studentsData.find((s) => s.id === selectedStudentId);
    }
    if (trialContactData) {
      // Return a mock student object for preview
      return {
        id: 'new-student-preview',
        first_name: trialContactData.student_first_name,
        last_name: trialContactData.student_last_name,
        email: trialContactData.student_email,
        phone: trialContactData.student_phone,
        curriculum: trialContactData.curriculum,
        year_level: trialContactData.year_level ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10)) : null,
        status: 'TRIAL' as const,
        created_at: null,
        created_by: null,
        invite_token: null,
        updated_at: null,
        user_id: null,
        school: null,
      } as Tables<'students'>;
    }
    return null;
  }, [selectedStudentId, studentsData, trialContactData]);

  const handleClose = () => {
    if (!isSubmitting) {
      setCurrentStep(0);
      setStudentSearch('');
      setSelectedStudentId('');
      setSelectedSubjectId('');
      setSelectedSlot(null);
      setSelectedStaffId('');
      setTrialContactData(null);
      setTrialContactFormRef(null);
      onClose();
    }
  };

  // Calculate step flow based on session type
  const getSteps = () => {
    const baseSteps = [];

    // For TRIAL_SESSION, always start with new student form (skip student selection)
    if (sessionType === 'TRIAL_SESSION') {
      // Step 0: Trial Contact Form (new student)
      baseSteps.push({
        id: 'trial-contact',
        title: 'Student Details',
      });
    } else {
      // Step 0: Select Student (for DRAFTING and SUBSIDY_INTERVIEW)
      baseSteps.push({
        id: 'student',
        title: 'Select Student',
      });
    }

    // Step 1: Select Subject (only for DRAFTING)
    if (sessionType === 'DRAFTING') {
      baseSteps.push({
        id: 'subject',
        title: 'Select Subject',
      });
    }
    // TRIAL_SESSION and SUBSIDY_INTERVIEW skip subject selection

    // Step 2: Select Time
    baseSteps.push({
      id: 'time',
      title: 'Select Time',
    });

    // Step 3: Select Staff
    baseSteps.push({
      id: 'staff',
      title: 'Select Staff',
    });

    // Step 4: Confirm
    baseSteps.push({
      id: 'confirm',
      title: 'Confirm Booking',
    });

    return baseSteps;
  };

  const steps = getSteps();

  const handleSlotSelect = (startAt: string, endAt: string, availableStaffIds: string[]) => {
    setSelectedSlot({ startAt, endAt, availableStaffIds });
    // Auto-select staff if only one available
    if (availableStaffIds.length === 1) {
      setSelectedStaffId(availableStaffIds[0]);
    }
    // Don't auto-advance - user must click Next button
  };

  const handleTrialContactSubmit = (data: AdminTrialContactFormValues) => {
    setTrialContactData(data);
    // Don't auto-advance - user must click Next button
  };

  const handleNext = async () => {
    const currentStepData = steps[currentStep];
    const currentStepId = currentStepData?.id;

    // For trial-contact step, validate form and show errors if invalid
    if (currentStepId === 'trial-contact' && trialContactFormRef) {
      // Trigger validation only on required fields
      const isValid = await trialContactFormRef.trigger(['student_first_name', 'student_last_name', 'student_phone']);
      if (!isValid) {
        // Form is invalid - errors will be shown on individual fields via FormMessage
        // Also show a toast with summary
        const errors = trialContactFormRef.formState.errors;
        const errorMessages: string[] = [];
        
        if (errors.student_first_name) {
          errorMessages.push('Student first name is required');
        }
        if (errors.student_last_name) {
          errorMessages.push('Student last name is required');
        }
        if (errors.student_phone) {
          errorMessages.push('Student phone number is required');
        }
        
        if (errorMessages.length > 0) {
          toast({
            title: 'Please fix the following errors',
            description: errorMessages.join(', '),
            variant: 'destructive',
          });
        }
        return; // Don't proceed if form is invalid
      }
      // Form is valid, save data
      const formValues = trialContactFormRef.getValues();
      setTrialContactData(formValues);
    }

    // Check if we can proceed
    if (!canGoNext()) {
      // Show validation errors for current step
      const currentStepData = steps[currentStep];
      const currentStepId = currentStepData?.id;
      
      if (currentStepId === 'student') {
        toast({
          title: 'Validation Error',
          description: 'Please select a student',
          variant: 'destructive',
        });
      } else if (currentStepId === 'subject' && sessionType === 'DRAFTING') {
        toast({
          title: 'Validation Error',
          description: 'Please select a subject for drafting sessions',
          variant: 'destructive',
        });
      } else if (currentStepId === 'time') {
        toast({
          title: 'Validation Error',
          description: 'Please select a time slot',
          variant: 'destructive',
        });
      } else if (currentStepId === 'staff') {
        toast({
          title: 'Validation Error',
          description: 'Please select a staff member',
          variant: 'destructive',
        });
      }
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canGoNext = () => {
    const currentStepData = steps[currentStep];
    const currentStepId = currentStepData?.id;

    switch (currentStepId) {
      case 'student':
        return !!selectedStudentId;
      case 'trial-contact':
        // Use tracked validity state for reactive updates
        return trialFormValid;
      case 'subject':
        // For DRAFTING, subject is required; for others it's optional
        return sessionType === 'DRAFTING' ? !!selectedSubjectId : true;
      case 'time':
        return !!selectedSlot;
      case 'staff':
        return !!selectedStaffId;
      case 'confirm':
        return true; // Always allow confirmation
      default:
        return false;
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedStaffId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a time slot and staff member',
        variant: 'destructive',
      });
      return;
    }

    let finalStudentId = selectedStudentId;

    // For trial sessions, create student if needed
    if (sessionType === 'TRIAL_SESSION' && !selectedStudentId && trialContactData) {
      try {
        setIsSubmitting(true);
        // Create student - using explicit type for Supabase insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const studentData: any = {
          id: crypto.randomUUID(),
          first_name: trialContactData.student_first_name,
          last_name: trialContactData.student_last_name,
          email: trialContactData.student_email || null,
          phone: trialContactData.student_phone,
          curriculum: trialContactData.curriculum || null,
          year_level: trialContactData.year_level ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10)) : null,
          status: 'TRIAL',
          created_at: null,
          created_by: null,
          invite_token: null,
          updated_at: null,
          user_id: null,
          school: null,
        };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdStudent = await createStudent.mutateAsync(studentData as any);

        // Assign subjects if provided
        if (trialContactData.subject_ids && trialContactData.subject_ids.length > 0) {
          await Promise.all(
            trialContactData.subject_ids.map((subjectId) =>
              studentsApi.assignSubjectToStudent(createdStudent.id, subjectId)
            )
          );
        }

        finalStudentId = createdStudent.id;
      } catch (error: unknown) {
        toast({
          title: 'Failed to Create Student',
          description: error instanceof Error ? error.message : 'Failed to create student. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (!finalStudentId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a student',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    if (sessionType === 'DRAFTING' && !selectedSubjectId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a subject for drafting sessions',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const sessionId = await createBooking.mutateAsync({
        session_type: sessionType,
        student_id: finalStudentId,
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId || undefined,
        staff_id: selectedStaffId,
      });

      toast({
        title: 'Booking Created',
        description: `${sessionType === 'DRAFTING' ? 'Drafting' : sessionType === 'TRIAL_SESSION' ? 'Trial' : 'Subsidy Interview'} session has been booked successfully`,
      });

      onBookingCreated?.(sessionId);
      handleClose();
    } catch (error: unknown) {
      toast({
        title: 'Booking Failed',
        description: error instanceof Error ? error.message : 'Failed to create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatStudentDisplay = (student: Tables<'students'>) => {
    return `${student.first_name} ${student.last_name}${student.email ? ` (${student.email})` : ''}`;
  };

  const formatSubjectDisplay = (subject: Tables<'subjects'>) => {
    const parts = [
      subject.curriculum,
      subject.year_level ? `Year ${subject.year_level}` : '',
      subject.name,
    ].filter(Boolean);
    return parts.join(' ');
  };

  const getSessionTypeLabel = () => {
    switch (sessionType) {
      case 'DRAFTING':
        return 'Drafting Session';
      case 'TRIAL_SESSION':
        return 'Trial Session';
      case 'SUBSIDY_INTERVIEW':
        return 'Subsidy Interview';
    }
  };

  const currentStepData = steps[currentStep];
  const currentStepId = currentStepData?.id;

  const renderStepContent = () => {
    switch (currentStepId) {
      case 'student':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-search">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Type student name or email..."
                  className="pl-10"
                />
              </div>
            </div>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentsData && studentsData.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {studentsData.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <StudentCard
                      student={student}
                      isSelecting={true}
                      isSelected={selectedStudentId === student.id}
                      showSubjects={false}
                      showActions={false}
                    />
                  </div>
                ))}
              </div>
            ) : studentSearch.length >= 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students found</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Type at least 2 characters to search</p>
              </div>
            )}
          </div>
        );

      case 'trial-contact':
        return (
          <AdminTrialContactForm
            onSubmit={handleTrialContactSubmit}
            defaultValues={trialContactData || undefined}
            onFormReady={setTrialContactFormRef}
            onValidityChange={setTrialFormValid}
          />
        );

      case 'subject':
        return (
          <div className="space-y-4">
            {sessionType === 'DRAFTING' ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Choose the subject for the drafting session
                </p>
                {selectedSubjectId ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 border rounded-md bg-muted/50">
                      {(() => {
                        // Check student subjects first, then all subjects
                        const subject = studentSubjects?.find((s) => s.id === selectedSubjectId) ||
                                       subjects?.find((s) => s.id === selectedSubjectId);
                        return subject ? formatSubjectDisplay(subject) : 'Unknown subject';
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedSubjectId('')}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <SubjectSearchPopover
                    selectedSubjects={[]}
                    onSelectSubject={(subject) => setSelectedSubjectId(subject.id)}
                    initialSubjects={studentSubjects || []}
                    trigger={
                      <Button variant="outline" className="w-full justify-start">
                        {studentSubjects && studentSubjects.length > 0
                          ? 'Select subject (shows student subjects, type to search all)'
                          : 'Select subject'}
                      </Button>
                    }
                  />
                )}
                {studentSubjects && studentSubjects.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Student has no subjects assigned. You can still search and select any subject.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Optionally choose a subject for the {sessionType === 'TRIAL_SESSION' ? 'trial' : 'subsidy interview'} session
                </p>
                {subjects && subjects.length > 0 && (
                  <Select 
                    value={selectedSubjectId || 'none'} 
                    onValueChange={(value) => setSelectedSubjectId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {formatSubjectDisplay(subject)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
        );

      case 'time':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an available time slot
            </p>
            <TimeSlotPicker
              sessionType={sessionType}
              subjectId={selectedSubjectId || undefined}
              durationMinutes={durationMinutes}
              onSlotSelect={handleSlotSelect}
              selectedSlot={selectedSlot ? { startAt: selectedSlot.startAt, endAt: selectedSlot.endAt } : null}
            />
          </div>
        );

      case 'staff':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a staff member for this session
            </p>
            {selectedSlot && selectedSlot.availableStaffIds.length > 0 ? (
              <StaffSelector
                availableStaffIds={selectedSlot.availableStaffIds}
                selectedStaffId={selectedStaffId}
                onSelect={setSelectedStaffId}
                disabled={isSubmitting}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please select a time slot first</p>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            {selectedSlot && (selectedStudentId || trialContactData) && selectedStaffId ? (
              <>
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
                          {selectedStudentId
                            ? (() => {
                                const student = studentsData?.find((s) => s.id === selectedStudentId);
                                return student ? formatStudentDisplay(student) : 'Unknown';
                              })()
                            : 'Unknown'}
                        </div>
                        
                        {selectedSubjectId && (() => {
                          const subjectList = sessionType === 'DRAFTING' ? studentSubjects : subjects;
                          const subject = subjectList?.find((s) => s.id === selectedSubjectId);
                          return subject ? (
                            <>
                              <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                              <div className="text-sm">{formatSubjectDisplay(subject)}</div>
                            </>
                          ) : null;
                        })()}
                      </>
                    )}
                    
                    <div className="text-sm font-medium text-muted-foreground">Date & Time:</div>
                    <div className="text-sm">
                      {new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                        timeZone: 'Australia/Adelaide',
                      })}
                    </div>
                    
                    <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                    <div className="text-sm">{durationMinutes} minutes</div>
                  </div>
                </div>

                {/* Calendar View */}
                {selectedSlot && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-4">Session in Calendar</h3>
                    <BookingConfirmationCalendar
                      newSession={{
                        start_at: selectedSlot.startAt,
                        end_at: selectedSlot.endAt,
                        type: sessionType,
                        subject_id: selectedSubjectId || null,
                      }}
                      existingSessions={sessionsData?.sessions
                        .filter((s) => s.start_at && s.end_at)
                        .map((s) => ({
                          id: s.id,
                          start_at: s.start_at!,
                          end_at: s.end_at!,
                          type: s.type,
                          subject_id: s.subject_id,
                          class_id: s.class_id,
                        }))}
                      subjectsById={sessionsData?.subjectsById || {}}
                      classesById={sessionsData?.classesById || {}}
                      sessionStaff={{
                        ...sessionsData?.sessionStaff,
                        'new-session-preview': selectedStaff ? [selectedStaff] : [],
                      }}
                      sessionStudents={{
                        ...sessionsData?.sessionStudents,
                        'new-session-preview': selectedStudent ? [selectedStudent] : [],
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please complete the previous steps</p>
              </div>
            )}
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-full md:max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Book {getSessionTypeLabel()}</DialogTitle>
          <DialogDescription>
            Create a new {getSessionTypeLabel().toLowerCase()} booking
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-2 px-6 py-4 border-b overflow-x-auto">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStep
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[400px]">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{currentStepData?.title}</h3>
          </div>
          {renderStepContent()}
        </div>

        {/* Footer with Back/Next buttons */}
        <div className="flex justify-between px-6 py-4 border-t bg-background">
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canGoNext() || isSubmitting}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleConfirmBooking} disabled={isSubmitting || !canGoNext()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Booking'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
