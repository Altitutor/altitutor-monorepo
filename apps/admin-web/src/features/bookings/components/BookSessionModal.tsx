'use client';

import { useState, useEffect } from 'react';
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
import { useAvailableSlots } from '../hooks/useAvailableSlots';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useCreateReservation } from '../hooks/useReservations';
import { studentsApi } from '@/features/students/api/students';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';

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
  const createReservation = useCreateReservation();

  const [currentStep, setCurrentStep] = useState(0);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
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

  // Get all subjects for drafting sessions
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAllSubjects(),
    enabled: isOpen && sessionType === 'DRAFTING',
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

  const handleClose = () => {
    if (!isSubmitting) {
      setCurrentStep(0);
      setStudentSearch('');
      setSelectedStudentId('');
      setSelectedSubjectId('');
      setSelectedSlot(null);
      onClose();
    }
  };

  const handleSlotSelect = async (startAt: string, endAt: string) => {
    setSelectedSlot({ startAt, endAt });
    setCurrentStep(2); // Move to confirmation step
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedStudentId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a student and time slot',
        variant: 'destructive',
      });
      return;
    }

    if (sessionType === 'DRAFTING' && !selectedSubjectId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a subject for drafting sessions',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionId = await createBooking.mutateAsync({
        session_type: sessionType,
        student_id: selectedStudentId,
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId || undefined,
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

  const steps = [
    {
      id: 'student',
      title: 'Select Student',
      component: (
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
                    setCurrentStep(1);
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
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'subject',
      title: sessionType === 'DRAFTING' ? 'Select Subject' : 'Select Subject (Optional)',
      component: (
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
              {subjects && subjects.length > 0 ? (
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
              ) : null}
            </>
          )}
          <Button
            onClick={() => setCurrentStep(2)}
            disabled={sessionType === 'DRAFTING' && !selectedSubjectId}
            className="w-full"
          >
            Continue to Time Selection
          </Button>
        </div>
      ),
    },
    {
      id: 'time',
      title: 'Select Time',
      component: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an available time slot
          </p>
          <TimeSlotPicker
            sessionType={sessionType}
            subjectId={selectedSubjectId || undefined}
            durationMinutes={60}
            onSlotSelect={handleSlotSelect}
            selectedSlot={selectedSlot}
          />
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm Booking',
      component: (
        <div className="space-y-4">
          {selectedSlot && selectedStudentId ? (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold">Booking Details</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Student:</span>{' '}
                    {(() => {
                      const student = studentsData?.find((s) => s.id === selectedStudentId);
                      return student ? formatStudentDisplay(student) : 'Unknown';
                    })()}
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
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(2);
                    setSelectedSlot(null);
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
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {getSessionTypeLabel()}</DialogTitle>
          <DialogDescription>
            Create a new {getSessionTypeLabel().toLowerCase()} booking
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2 py-4 border-b">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
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
        <div className="py-4">{currentStepData.component}</div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

