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
import { Loader2, Search } from 'lucide-react';
import { TimeSlotPicker } from './TimeSlotPicker';
import { StaffSelector } from './StaffSelector';
import { AdminTrialContactForm, type AdminTrialContactFormValues } from './AdminTrialContactForm';
import { BookingCalendarView } from '@altitutor/ui';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { studentsApi } from '@/features/students/api/students';
import { useCreateStudent } from '@/features/students/hooks/useStudentsQuery';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import type { UseFormReturn } from 'react-hook-form';

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

  // Search students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'search', studentSearch],
    queryFn: async () => {
      const result = await studentsApi.searchStudents(studentSearch);
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
        .map((row: any) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: isOpen && !!selectedStudentId && sessionType === 'DRAFTING',
  });

  // Get sessions for calendar view (week of selected slot)
  const weekStart = useMemo(() => {
    if (!selectedSlot) return startOfWeek(new Date(), { weekStartsOn: 1 });
    return startOfWeek(new Date(selectedSlot.startAt), { weekStartsOn: 1 });
  }, [selectedSlot]);

  const weekEnd = useMemo(() => {
    if (!selectedSlot) return endOfWeek(new Date(), { weekStartsOn: 1 });
    return endOfWeek(new Date(selectedSlot.startAt), { weekStartsOn: 1 });
  }, [selectedSlot]);

  const { data: sessionsData } = useSessionsWithDetails({
    rangeStart: format(weekStart, 'yyyy-MM-dd'),
    rangeEnd: format(weekEnd, 'yyyy-MM-dd'),
    includeInactive: false,
  });

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

    // Step 0: Select Student
    baseSteps.push({
      id: 'student',
      title: 'Select Student',
    });

    // Step 1: Trial Contact Form (only for TRIAL_SESSION when no student selected)
    if (sessionType === 'TRIAL_SESSION') {
      baseSteps.push({
        id: 'trial-contact',
        title: 'Student Details',
      });
    }

    // Step 2: Select Subject
    if (sessionType === 'DRAFTING') {
      baseSteps.push({
        id: 'subject',
        title: 'Select Subject',
      });
    } else {
      baseSteps.push({
        id: 'subject',
        title: 'Select Subject (Optional)',
      });
    }

    // Step 3: Select Time
    baseSteps.push({
      id: 'time',
      title: 'Select Time',
    });

    // Step 4: Select Staff
    baseSteps.push({
      id: 'staff',
      title: 'Select Staff',
    });

    // Step 5: Confirm
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
    // Move to staff selection step
    const timeStepIndex = steps.findIndex((s) => s.id === 'time');
    setCurrentStep(timeStepIndex + 1);
  };

  const handleTrialContactSubmit = (data: AdminTrialContactFormValues) => {
    setTrialContactData(data);
    // Move to subject selection step
    const contactStepIndex = steps.findIndex((s) => s.id === 'trial-contact');
    setCurrentStep(contactStepIndex + 1);
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
        // Create student
        const studentData: any = {
          id: crypto.randomUUID(),
          first_name: trialContactData.student_first_name,
          last_name: trialContactData.student_last_name,
          email: trialContactData.student_email,
          phone: trialContactData.student_phone,
          curriculum: trialContactData.curriculum,
          year_level: trialContactData.year_level ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10)) : null,
          status: 'TRIAL',
          created_at: null,
          created_by: null,
          invite_token: null,
          updated_at: null,
          user_id: null,
          school: null,
        };

        const createdStudent = await createStudent.mutateAsync(studentData);

        // Assign subjects
        if (trialContactData.subject_ids.length > 0) {
          await Promise.all(
            trialContactData.subject_ids.map((subjectId) =>
              studentsApi.assignSubjectToStudent(createdStudent.id, subjectId)
            )
          );
        }

        finalStudentId = createdStudent.id;
      } catch (error: any) {
        toast({
          title: 'Failed to Create Student',
          description: error.message || 'Failed to create student. Please try again.',
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
    } catch (error: any) {
      toast({
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking. Please try again.',
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
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {studentsData.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      // Move to next step
                      const studentStepIndex = steps.findIndex((s) => s.id === 'student');
                      if (sessionType === 'TRIAL_SESSION') {
                        // Skip trial contact form if student exists
                        setCurrentStep(studentStepIndex + 2); // Skip to subject step
                      } else {
                        setCurrentStep(studentStepIndex + 1);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedStudentId === student.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {formatStudentDisplay(student)}
                  </button>
                ))}
              </div>
            ) : studentSearch.length >= 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students found</p>
                {sessionType === 'TRIAL_SESSION' && (
                  <p className="text-xs mt-2">Continue to create a new student</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Type at least 2 characters to search</p>
                {sessionType === 'TRIAL_SESSION' && (
                  <Button
                    onClick={() => {
                      const studentStepIndex = steps.findIndex((s) => s.id === 'student');
                      setCurrentStep(studentStepIndex + 1); // Move to trial contact form
                    }}
                    className="mt-4"
                  >
                    Create New Student
                  </Button>
                )}
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
                {studentSubjects && studentSubjects.length > 0 ? (
                  <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {studentSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {formatSubjectDisplay(subject)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Student has no subjects assigned. Please assign subjects first.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Optionally choose a subject for the {sessionType === 'TRIAL_SESSION' ? 'trial' : 'subsidy interview'} session
                </p>
                {subjects && subjects.length > 0 && (
                  <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
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
            <Button
              onClick={() => {
                const subjectStepIndex = steps.findIndex((s) => s.id === 'subject');
                setCurrentStep(subjectStepIndex + 1);
              }}
              disabled={sessionType === 'DRAFTING' && !selectedSubjectId}
              className="w-full"
            >
              Continue to Time Selection
            </Button>
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
              durationMinutes={60}
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
            {selectedStaffId && (
              <Button
                onClick={() => {
                  const staffStepIndex = steps.findIndex((s) => s.id === 'staff');
                  setCurrentStep(staffStepIndex + 1);
                }}
                className="w-full"
              >
                Continue to Confirmation
              </Button>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            {selectedSlot && (selectedStudentId || trialContactData) && selectedStaffId ? (
              <>
                <div className="space-y-2">
                  <h3 className="font-semibold">Booking Details</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">Student:</span>{' '}
                      {selectedStudentId
                        ? (() => {
                            const student = studentsData?.find((s) => s.id === selectedStudentId);
                            return student ? formatStudentDisplay(student) : 'Unknown';
                          })()
                        : trialContactData
                        ? `${trialContactData.student_first_name} ${trialContactData.student_last_name}`
                        : 'Unknown'}
                    </div>
                    {selectedSubjectId && (() => {
                      const subjectList = sessionType === 'DRAFTING' ? studentSubjects : subjects;
                      const subject = subjectList?.find((s) => s.id === selectedSubjectId);
                      return subject ? (
                        <div>
                          <span className="font-medium">Subject:</span>{' '}
                          {formatSubjectDisplay(subject)}
                        </div>
                      ) : null;
                    })()}
                    <div>
                      <span className="font-medium">Date & Time:</span>{' '}
                      {new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                        timeZone: 'Australia/Adelaide',
                      })}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> 60 minutes
                    </div>
                  </div>
                </div>

                {/* Calendar View */}
                {selectedSlot && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-4">Session in Calendar</h3>
                    <BookingCalendarView
                      newSession={{
                        start_at: selectedSlot.startAt,
                        end_at: selectedSlot.endAt,
                        type: sessionType,
                        subject_id: selectedSubjectId || null,
                      }}
                      existingSessions={sessionsData?.sessions.map((s) => ({
                        id: s.id,
                        start_at: s.start_at,
                        end_at: s.end_at,
                        type: s.type,
                        subject_id: s.subject_id,
                        class_id: s.class_id,
                      }))}
                      subjectsById={sessionsData?.subjectsById || {}}
                      classesById={sessionsData?.classesById || {}}
                      weekAnchor={new Date(selectedSlot.startAt)}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const confirmStepIndex = steps.findIndex((s) => s.id === 'confirm');
                      setCurrentStep(confirmStepIndex - 1);
                    }}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Booking'
                    )}
                  </Button>
                </div>
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {getSessionTypeLabel()}</DialogTitle>
          <DialogDescription>
            Create a new {getSessionTypeLabel().toLowerCase()} booking
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2 py-4 border-b overflow-x-auto">
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
        <div className="py-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{currentStepData?.title}</h3>
          </div>
          {renderStepContent()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
