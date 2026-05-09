'use client';

import { useState, useEffect } from 'react';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { MessageSquare, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import {
  getEnrollmentConfirmationMessageForClient,
  getSenderNameFromStaff,
} from '@/features/messages/api/systemTemplates';
import { formatDate } from '@/shared/utils/datetime';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { useCurrentStaff } from '@/shared/hooks';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { useParentsForStudent } from '../../hooks/useParentsForStudent';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { StudentWithEnrollmentInfo } from '../../types/enrollment';

interface Step4MessageScreenProps {
  selectedStudent?: StudentWithEnrollmentInfo | Tables<'students'>;
  selectedClass?: ClassWithExpandedSubject;
  enrollmentDate: string;
}

export function Step4MessageScreen({
  selectedStudent,
  selectedClass,
  enrollmentDate,
}: Step4MessageScreenProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'student' | 'parent'; id?: string; label: string; value: string } | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const { data: parentsData = [] } = useParentsForStudent(selectedStudent?.id, !!selectedStudent?.id);
  const parents = parentsData;
  const { data: currentStaff } = useCurrentStaff();

  // Build recipient options (student phone and parent phones only)
  useEffect(() => {
    if (!selectedStudent) return;

    const recipients: Array<{ type: 'student' | 'parent'; id?: string; label: string; value: string }> = [];
    
    // Student phone first
    if (selectedStudent.phone) {
      recipients.push({
        type: 'student',
        label: 'Student Phone',
        value: selectedStudent.phone,
      });
    }
    
    // Then parent phones
    parents.forEach((parent) => {
      if (parent.phone) {
        recipients.push({
          type: 'parent',
          id: parent.id,
          label: `${parent.first_name} ${parent.last_name} Phone`,
          value: parent.phone,
        });
      }
    });

    // Set default recipient (first one) only if not already set
    if (recipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(recipients[0]);
    }
  }, [selectedStudent, parents, selectedRecipient]);

  // Get contactId when phone recipient is selected
  useEffect(() => {
    if (!selectedRecipient || !selectedStudent?.id) {
      setContactId(null);
      return;
    }

    const fetchContactId = async () => {
      try {
        if (selectedRecipient.type === 'student') {
          const cid = await getContactIdByRelatedId(selectedStudent.id, 'student');
          setContactId(cid);
        } else if (selectedRecipient.type === 'parent' && selectedRecipient.id) {
          const cid = await getContactIdByRelatedId(selectedRecipient.id, 'parent');
          setContactId(cid);
        }
      } catch (error) {
        console.error('Error fetching contactId:', error);
        setContactId(null);
      }
    };

    fetchContactId();
  }, [selectedRecipient, selectedStudent?.id]);

  // Pre-populate message with enrollment template when recipient changes
  useEffect(() => {
    if (!selectedRecipient || !selectedClass || !selectedStudent || !enrollmentDate || !currentStaff)
      return;

    // Calculate first session date
    const firstSessionDate =
      selectedClass.day_of_week !== undefined && selectedClass.start_time
        ? calculateFirstSessionDate(
            { day_of_week: selectedClass.day_of_week, start_time: selectedClass.start_time },
            getMidnightAdelaide(new Date(enrollmentDate))
          )
        : null;

    if (!firstSessionDate) return;

    // Format class name with day and time
    const className = selectedClass.long_name?.trim() ?? '';

    // Format start date
    const startDate = formatDate(firstSessionDate);

    // Get recipient name
    const recipientName =
      selectedRecipient.type === 'parent'
        ? parents.find((p) => p.id === selectedRecipient.id)?.first_name || 'there'
        : selectedStudent.first_name || 'there';

    const senderName = getSenderNameFromStaff(currentStaff);

    let cancelled = false;
    (async () => {
      const template = await getEnrollmentConfirmationMessageForClient({
        name: recipientName,
        className,
        startDate,
        senderName,
      });
      if (cancelled) return;
      setComposerDraft(template);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRecipient, selectedClass, selectedStudent, enrollmentDate, currentStaff, parents]);

  // Build recipient options for dropdown
  const recipientOptions: Array<{ type: 'student' | 'parent'; id?: string; label: string; value: string }> = [];
  if (selectedStudent?.phone) {
    recipientOptions.push({
      type: 'student',
      label: 'Student Phone',
      value: selectedStudent.phone,
    });
  }
  parents.forEach((parent) => {
    if (parent.phone) {
      recipientOptions.push({
        type: 'parent',
        id: parent.id,
        label: `${parent.first_name} ${parent.last_name} Phone`,
        value: parent.phone,
      });
    }
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      {/* Success Indicator */}
      {selectedStudent && selectedClass && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Successfully enrolled{' '}
            <span className="font-semibold">
              {selectedStudent.first_name} {selectedStudent.last_name}
            </span>
            {' '}in{' '}
            <span className="font-semibold">
              {selectedClass.long_name?.trim() || 'class'}
            </span>
          </p>
        </div>
      )}


      {/* Message Section */}
      {selectedRecipient && recipientOptions.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden">
          {/* Fixed Header with recipient dropdown */}
          <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Message</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    <span className="text-xs">{selectedRecipient.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">• {selectedRecipient.value}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {recipientOptions.map((option, index) => (
                    <DropdownMenuItem
                      key={`${option.type}-${option.id || 'student'}-${index}`}
                      onClick={() => setSelectedRecipient(option)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{option.label}</span>
                          <span className="text-xs text-muted-foreground truncate">{option.value}</span>
                        </div>
                      </div>
                      {selectedRecipient?.type === option.type && 
                       selectedRecipient?.id === option.id && (
                        <Check className="h-4 w-4 ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Scrollable Message Thread */}
          {contactId ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <MessageThread contactId={contactId} />
              </div>
              <div className="flex-shrink-0 border-t">
                <Composer 
                  contactId={contactId}
                  draft={composerDraft}
                  onDraftChange={setComposerDraft}
                  onDraftClear={() => setComposerDraft('')}
                  onBeforeSend={async (_messageBody, _selectedSenderId) => {
                    // Allow sending through Composer - it handles the message sending
                    return null;
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Loading contact...</div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            No phone number found for student or parents. Please add contact information before sending.
          </p>
        </div>
      )}
    </div>
  );
}
