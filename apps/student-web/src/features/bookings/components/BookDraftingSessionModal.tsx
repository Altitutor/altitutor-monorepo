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
import { Button, SearchableSelect, useToast } from '@altitutor/ui';
import { Loader2, Check, Upload, X, File } from 'lucide-react';
import { sessionFilesApi } from '../api/session-files';
import { TimeSlotPicker } from './TimeSlotPicker';
import { BookingConfirmationCalendar } from './BookingConfirmationCalendar';
import { useStudentSubjects } from '../hooks/useStudentSubjects';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useMyReservations } from '../hooks/useReservations';
import { useStudentSessions } from '@/shared/hooks';
import { pricingApi } from '../api/pricing';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Tables } from '@altitutor/shared';
import { cn, getErrorMessage } from '@/shared/utils';
import { useSessionDurationMinutes } from '../hooks/useBookingSettings';
export interface BookDraftingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated?: (sessionId: string) => void;
  originalSessionId?: string | null; // Optional: if provided, this is a reschedule operation
  originalSubjectId?: string | null; // Optional: subject ID from the original session (for reschedule)
}

export function BookDraftingSessionModal({
  isOpen,
  onClose,
  onBookingCreated,
  originalSessionId = null,
  originalSubjectId = null,
}: BookDraftingSessionModalProps) {
  const { toast } = useToast();
  const { data: subjects, isLoading: subjectsLoading } = useStudentSubjects();
  const { data: reservations } = useMyReservations();
  const createBooking = useCreateBooking();

  // Get default drafting session duration from booking settings
  const { data: defaultDurationMinutes = 60 } = useSessionDurationMinutes('DRAFTING');

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds: string[] } | null>(null);
  
  // Calculate duration from selected slot, default to booking settings value if no slot selected
  const durationMinutes = selectedSlot
    ? Math.round((new Date(selectedSlot.endAt).getTime() - new Date(selectedSlot.startAt).getTime()) / (1000 * 60))
    : defaultDurationMinutes;
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Auto-select subject from original session when rescheduling
  useEffect(() => {
    if (isOpen && originalSubjectId && subjects) {
      // Verify the subject is still available to the student
      const subjectExists = subjects.some(s => s.id === originalSubjectId);
      if (subjectExists && !selectedSubjectId) {
        // Only set if not already selected (to avoid overriding user selection)
        setSelectedSubjectId(originalSubjectId);
        // Auto-advance to time selection step if subject is pre-selected
        setCurrentStep(1);
      }
    }
  }, [isOpen, originalSubjectId, subjects, selectedSubjectId]);

  // Get the active reservation for the selected slot
  const activeReservation = reservations?.find(
    (r) => r.start_at === selectedSlot?.startAt && r.end_at === selectedSlot?.endAt
  );

  const handleSlotSelect = (startAt: string, endAt: string, availableStaffIds: string[]) => {
    setSelectedSlot({ startAt, endAt, availableStaffIds });
    // Don't auto-proceed - user must click Next
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    // Reset state
    setCurrentStep(0);
    setSelectedSubjectId('');
    setSelectedSlot(null);
    setBookingSuccess(false);
    setCreatedSessionId(null);
    setSubjectError(false);
    setTimeError(false);
    setSelectedFiles([]);
    setUploadingFiles(false);
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // From subject selection to time selection
      if (!selectedSubjectId) {
        setSubjectError(true);
        toast({
          title: 'Please select a subject',
          description: 'You must select a subject before continuing',
          variant: 'destructive',
        });
        return;
      }
      setSubjectError(false);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // From time selection to file upload
      if (!selectedSlot) {
        setTimeError(true);
        toast({
          title: 'Please select a time slot',
          description: 'You must select a time slot before continuing',
          variant: 'destructive',
        });
        return;
      }
      setTimeError(false);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // From file upload to confirmation (files are optional)
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && !bookingSuccess) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedSubjectId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a subject and time slot',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate that staff is still available before booking
      if (!selectedSlot.availableStaffIds || selectedSlot.availableStaffIds.length === 0) {
        toast({
          title: 'Slot No Longer Available',
          description: 'This time slot is no longer available. Please select another time.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Don't pass staff_id - let the database function auto-assign based on current availability
      // This ensures we get the most up-to-date staff availability
      const sessionId = await createBooking.mutateAsync({
        session_type: 'DRAFTING',
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId,
        staff_id: undefined, // Let function auto-assign
        reservation_id: activeReservation?.id,
        original_session_id: originalSessionId || undefined,
      });

      setCreatedSessionId(sessionId);

      // Upload files if any were selected
      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        try {
          await Promise.all(
            selectedFiles.map(async (file, index) => {
              try {
                await sessionFilesApi.uploadSessionFile({
                  sessionId,
                  file,
                  displayOrder: index,
                });
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorWithDetails = error as { message?: string; statusCode?: number; error?: { code?: string; message?: string } };
                console.error(`Failed to upload ${file.name}:`, {
                  error,
                  message: errorWithDetails.message,
                  statusCode: errorWithDetails.statusCode,
                  errorCode: errorWithDetails.error?.code,
                  errorMessage: errorWithDetails.error?.message,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                  sessionId,
                });
                toast({
                  title: 'File Upload Failed',
                  description: `Failed to upload ${file.name}: ${errorMessage || errorWithDetails.error?.message || 'Unknown error'}. You can add it later.`,
                  variant: 'destructive',
                });
              }
            })
          );
        } finally {
          setUploadingFiles(false);
        }
      }

      setBookingSuccess(true);
      setCurrentStep(4); // Move to success step
      onBookingCreated?.(sessionId);
    } catch (error: unknown) {
      toast({
        title: 'Booking Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).filter(file => {
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: `${file.name} exceeds the 50MB limit`,
          variant: 'destructive',
        });
        return false;
      }
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid File Type',
          description: `${file.name} is not a supported file type`,
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSubjectDisplay = (subject: Tables<'subjects'>) => {
    const parts = [
      subject.curriculum,
      subject.year_level ? `Year ${subject.year_level}` : '',
      subject.name,
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Steps for indicator (only show 4 steps, success is not a step)
  const steps = [
    { id: 'subject', title: 'Select Subject' },
    { id: 'time', title: 'Select Time' },
    { id: 'files', title: 'Upload Files' },
    { id: 'confirm', title: 'Confirm Booking' },
  ];

  // Get sessions for the selected day (for calendar display)
  const sessionDate = selectedSlot ? new Date(selectedSlot.startAt) : new Date();
  const dayStart = new Date(sessionDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(sessionDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: daySessions } = useStudentSessions(
    format(dayStart, 'yyyy-MM-dd'),
    format(dayEnd, 'yyyy-MM-dd')
  );

  // Get pricing for the selected session
  const { data: sessionPrice } = useQuery({
    queryKey: ['session-price', selectedSubjectId, selectedSlot?.startAt, selectedSlot?.endAt],
    queryFn: () => {
      if (!selectedSlot || !selectedSubjectId) return null;
      return pricingApi.calculateDraftingSessionPrice(
        selectedSubjectId,
        selectedSlot.startAt,
        selectedSlot.endAt
      );
    },
    enabled: !!selectedSlot && !!selectedSubjectId && currentStep >= 2,
  });

  // Get the created session details for success step (to show staff info)
  const bookedSession = createdSessionId && daySessions
    ? daySessions.find(s => s.session_id === createdSessionId)
    : null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;

  const renderStepContent = () => {
    if (bookingSuccess && currentStep === 4) {
      const subject = subjects?.find((s) => s.id === selectedSubjectId);
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Left side - Success message and details */}
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Booking Confirmed!</h3>
                <p className="text-muted-foreground">
                  Your drafting session has been booked successfully
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <h4 className="font-semibold">Booking Details</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {subject && (
                  <>
                    <div className="text-muted-foreground font-medium">Subject:</div>
                    <div>{formatSubjectDisplay(subject)}</div>
                  </>
                )}
                <div className="text-muted-foreground font-medium">Date & Time:</div>
                <div>
                  {selectedSlot && new Date(selectedSlot.startAt).toLocaleString('en-AU', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                    timeZone: 'Australia/Adelaide',
                  })}
                </div>
                <div className="text-muted-foreground font-medium">Duration:</div>
                <div>{durationMinutes} minutes</div>
              </div>
            </div>
          </div>

          {/* Right side - Calendar */}
          {selectedSlot && (
            <div className="space-y-2">
              <h4 className="font-semibold">Session in Calendar</h4>
              <BookingConfirmationCalendar
                newSession={{
                  start_at: selectedSlot.startAt,
                  end_at: selectedSlot.endAt,
                  type: 'DRAFTING',
                  subject_id: selectedSubjectId || null,
                  subject: subject || null,
                  staff: bookedSession?.staff || [],
                }}
                existingSessions={(daySessions || []).filter(s => s.session_id !== createdSessionId)}
              />
            </div>
          )}
        </div>
      );
    }

    switch (currentStepData?.id) {
      case 'subject':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose the subject for your drafting session
            </p>
            {subjectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !subjects || subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No subjects found. Please contact support to add subjects to your account.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <SearchableSelect<Tables<'subjects'>>
                  items={subjects}
                  value={subjects.find((s) => s.id === selectedSubjectId) ?? null}
                  onValueChange={(item) => {
                    if (item) {
                      setSelectedSubjectId(item.id);
                      setSubjectError(false);
                    }
                  }}
                  getItemLabel={formatSubjectDisplay}
                  getItemId={(s) => s.id}
                  placeholder="Select a subject"
                  triggerClassName={cn(subjectError && 'border-destructive')}
                />
                {subjectError && (
                  <p className="text-sm text-destructive">
                    Please select a subject to continue
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'time':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an available time slot for your drafting session
            </p>
            {selectedSubjectId ? (
              <div className="space-y-2">
                <TimeSlotPicker
                  sessionType="DRAFTING"
                  subjectId={selectedSubjectId}
                  durationMinutes={defaultDurationMinutes}
                  onSlotSelect={(startAt, endAt, availableStaffIds) => {
                    handleSlotSelect(startAt, endAt, availableStaffIds);
                    setTimeError(false);
                  }}
                  selectedSlot={selectedSlot}
                />
                {timeError && (
                  <p className="text-sm text-destructive">
                    Please select a time slot to continue
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please select a subject first</p>
              </div>
            )}
          </div>
        );

      case 'files':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optionally upload files for your drafting session (PDFs, Word documents, images, etc.)
            </p>
            
            {/* File Upload Area */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                'hover:border-primary/50 cursor-pointer',
                'bg-muted/50'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFileSelect(e.dataTransfer.files);
              }}
            >
              <input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpeg,.jpg,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/jpg,image/gif,image/webp"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, PowerPoint, Images (Max 50MB per file)
                </p>
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-3 border rounded-lg bg-background"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            {selectedSlot && selectedSubjectId ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Booking Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Booking Details</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {(() => {
                        const subject = subjects?.find((s) => s.id === selectedSubjectId);
                        return subject ? (
                          <>
                            <div className="text-sm font-medium text-muted-foreground">Subject:</div>
                            <div className="text-sm">{formatSubjectDisplay(subject)}</div>
                          </>
                        ) : null;
                      })()}
                      
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

                      {sessionPrice && (
                        <>
                          <div className="text-sm font-medium text-muted-foreground">Price:</div>
                          <div className="text-sm font-semibold">
                            ${(sessionPrice.amount_cents / 100).toFixed(2)} {sessionPrice.currency.toUpperCase()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Files Section */}
                  {selectedFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Files to Upload ({selectedFiles.length})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-3 p-3 border rounded-lg bg-background"
                          >
                            <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side - Calendar */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Session in Calendar</h4>
                  <BookingConfirmationCalendar
                    newSession={{
                      start_at: selectedSlot.startAt,
                      end_at: selectedSlot.endAt,
                      type: 'DRAFTING',
                      subject_id: selectedSubjectId || null,
                      subject: subjects?.find((s) => s.id === selectedSubjectId) || null,
                      staff: [], // Will be populated after booking
                    }}
                    existingSessions={daySessions || []}
                  />
                </div>
              </div>
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
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>
            {originalSessionId ? 'Reschedule Drafting Session' : 'Book Drafting Session'}
          </DialogTitle>
          <DialogDescription>
            {originalSessionId 
              ? 'Select a new time for your drafting session. Your original session will be marked as an absence.'
              : 'Schedule a one-on-one drafting session with a tutor'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator - Only show 3 steps (success is not a step) */}
        <div className="flex-shrink-0 flex items-center justify-center space-x-2 px-6 py-4 border-b overflow-x-auto">
          {steps.map((step, index) => {
            // When on success step (step 3), show all steps as completed
            const isCompleted = bookingSuccess || index < currentStep;
            const isCurrent = !bookingSuccess && index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-12 h-0.5 mx-2',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Content */}
        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">
          <div className="h-full overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{currentStepData?.title}</h3>
            </div>
            {renderStepContent()}
          </div>
        </div>

        {/* Footer with Back/Next buttons */}
        {!bookingSuccess && (
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep === 3 ? (
                  // Confirmation step - show Confirm Booking button
                  <Button
                    onClick={handleConfirmBooking}
                    disabled={isSubmitting || uploadingFiles || !selectedSlot || !selectedSubjectId}
                  >
                    {isSubmitting || uploadingFiles ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uploadingFiles ? 'Uploading files...' : 'Confirming...'}
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </Button>
                ) : (
                  // Other steps - show Next button
                  <Button
                    onClick={handleNext}
                    disabled={isSubmitting || (currentStep === 0 && !selectedSubjectId) || (currentStep === 1 && !selectedSlot)}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}

        {/* Success Footer */}
        {bookingSuccess && (
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
