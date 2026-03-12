'use client';

import { useState, useEffect } from 'react';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { MessageSquare, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import { getUnenrollmentConfirmationSmsTemplate } from '@/shared/lib/sms-templates';
import { formatSessionDateTime } from '@/shared/utils/schedule';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { useCurrentStaff } from '@/shared/hooks';
import { calculateLastSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { useParentsForStudent } from '../../hooks/useParentsForStudent';
import type { Tables } from '@altitutor/shared';

interface UnenrollStep3MessageScreenProps {
  student: Tables<'students'>;
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  unenrollmentDate: string;
}

export function UnenrollStep3MessageScreen({
  student,
  classData,
  classSubject,
  unenrollmentDate,
}: UnenrollStep3MessageScreenProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'student' | 'parent'; id?: string; label: string; value: string } | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const { data: parentsData = [] } = useParentsForStudent(student?.id, !!student?.id);
  const parents = parentsData;
  const { data: currentStaff } = useCurrentStaff();

  // Build recipient options (student phone and parent phones only)
  useEffect(() => {
    if (!student) return;

    const recipients: Array<{ type: 'student' | 'parent'; id?: string; label: string; value: string }> = [];
    
    // Student phone first
    if (student.phone) {
      recipients.push({
        type: 'student',
        label: 'Student Phone',
        value: student.phone,
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
  }, [student, parents, selectedRecipient]);

  // Get contactId when phone recipient is selected
  useEffect(() => {
    if (!selectedRecipient || !student?.id) {
      setContactId(null);
      return;
    }

    const fetchContactId = async () => {
      try {
        if (selectedRecipient.type === 'student') {
          const cid = await getContactIdByRelatedId(student.id, 'student');
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
  }, [selectedRecipient, student?.id]);

  // Pre-populate message with unenrollment template when recipient changes
  useEffect(() => {
    if (!selectedRecipient || !classData || !student || !unenrollmentDate || !currentStaff) return;

    // Calculate last session date
    const lastSessionDate = calculateLastSessionDate(
      classData,
      getMidnightAdelaide(new Date(unenrollmentDate))
    );

    if (!lastSessionDate) return;

    // Format class name with day and time
    const className = classSubject
      ? (classData.long_name?.trim() ?? '')
      : 'class';
    
    // Format final session date
    const finalSessionDate = formatSessionDateTime(lastSessionDate);

    // Get recipient name
    const recipientName = selectedRecipient.type === 'parent'
      ? parents.find(p => p.id === selectedRecipient.id)?.first_name || 'there'
      : student.first_name || 'there';

    // Get sender name
    const senderName = `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim();

    // Generate template
    const template = getUnenrollmentConfirmationSmsTemplate({
      name: recipientName,
      className,
      finalSessionDate,
      senderName,
    });

    // Set template when recipient changes (reset draft)
    setComposerDraft(template);
  }, [selectedRecipient, classData, student, unenrollmentDate, currentStaff, classSubject, parents]);

  // Build recipient options for dropdown
  const recipientOptions: Array<{ type: 'student' | 'parent'; id?: string; label: string; value: string }> = [];
  if (student?.phone) {
    recipientOptions.push({
      type: 'student',
      label: 'Student Phone',
      value: student.phone,
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
    <div className="flex flex-col h-full min-h-0">
      {/* Success Indicator */}
      {student && classData && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Successfully unenrolled{' '}
            <span className="font-semibold">
              {student.first_name} {student.last_name}
            </span>
            {' '}from{' '}
            <span className="font-semibold">
              {classData.long_name?.trim() || 'class'}
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
