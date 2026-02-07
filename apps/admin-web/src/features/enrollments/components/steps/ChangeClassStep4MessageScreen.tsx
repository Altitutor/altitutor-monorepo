'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { MessageSquare, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import { getChangeClassConfirmationSmsTemplate } from '@/shared/lib/sms-templates';
import { formatClassName } from '@/shared/utils';
import { formatSessionDateTime } from '@/shared/utils/schedule';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { calculateLastSessionDate, calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ChangeClassStep4MessageScreenProps {
  student: Tables<'students'>;
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  selectedNewClass?: ClassWithExpandedSubject;
  changeoverDate: string;
}

export function ChangeClassStep4MessageScreen({
  student,
  oldClass,
  oldClassSubject,
  selectedNewClass,
  changeoverDate,
}: ChangeClassStep4MessageScreenProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<{ type: 'student' | 'parent'; id?: string; label: string; value: string } | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const [parents, setParents] = useState<Array<{ id: string; first_name: string; last_name: string; phone: string | null }>>([]);
  const { data: currentStaff } = useCurrentStaff();

  // Fetch parents
  useEffect(() => {
    if (!student?.id) return;

    const fetchParents = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data: parentsData, error } = await supabase
        .from('parents_students')
        .select('parent_id, parents(id, first_name, last_name, phone)')
        .eq('student_id', student.id);

      if (!error && parentsData) {
        const parentList = parentsData
          .map((ps: any) => ps.parents)
          .filter((p: any) => p !== null && p.phone)
          .map((p: any) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
          }));
        setParents(parentList);
      }
    };

    fetchParents();
  }, [student?.id]);

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
  }, [student, parents]);

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
  }, [selectedRecipient?.id, selectedRecipient?.type, student?.id]);

  // Pre-populate message with change class template when recipient changes
  useEffect(() => {
    if (!selectedRecipient || !oldClass || !selectedNewClass || !student || !changeoverDate || !currentStaff) return;

    // Calculate last session date for old class
    const lastSessionDate = calculateLastSessionDate(
      oldClass,
      getMidnightAdelaide(new Date(changeoverDate))
    );

    // Calculate first session date for new class
    const firstSessionDate = selectedNewClass.day_of_week !== undefined && selectedNewClass.start_time
      ? calculateFirstSessionDate(
          { day_of_week: selectedNewClass.day_of_week, start_time: selectedNewClass.start_time },
          getMidnightAdelaide(new Date(changeoverDate))
        )
      : null;

    if (!lastSessionDate || !firstSessionDate) return;

    // Format class names
    const oldClassName = oldClassSubject
      ? formatClassName(oldClass, oldClassSubject)
      : 'class';
    
    const newClassName = selectedNewClass.subject
      ? formatClassName(selectedNewClass, selectedNewClass.subject)
      : 'class';
    
    // Format session dates
    const oldClassLastSessionDateFormatted = formatSessionDateTime(lastSessionDate);
    const newClassFirstSessionDateFormatted = formatSessionDateTime(firstSessionDate);

    // Get recipient name
    const recipientName = selectedRecipient.type === 'parent'
      ? parents.find(p => p.id === selectedRecipient.id)?.first_name || 'there'
      : student.first_name || 'there';

    // Get sender name
    const senderName = `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim();

    // Generate template
    const template = getChangeClassConfirmationSmsTemplate({
      name: recipientName,
      oldClassName,
      newClassName,
      oldClassLastSessionDate: oldClassLastSessionDateFormatted,
      newClassFirstSessionDate: newClassFirstSessionDateFormatted,
      senderName,
    });

    // Set template when recipient changes (reset draft)
    setComposerDraft(template);
  }, [selectedRecipient?.id, selectedRecipient?.type, oldClass?.id, selectedNewClass?.id, selectedNewClass?.day_of_week, selectedNewClass?.start_time, student?.id, changeoverDate, currentStaff?.id, oldClassSubject, parents]);

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
      {student && oldClass && selectedNewClass && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Successfully changed{' '}
            <span className="font-semibold">
              {student.first_name} {student.last_name}
            </span>
            {'\'s class from '}
            <span className="font-semibold">
              {oldClassSubject ? formatClassName(oldClass, oldClassSubject) : 'class'}
            </span>
            {' to '}
            <span className="font-semibold">
              {selectedNewClass.subject ? formatClassName(selectedNewClass, selectedNewClass.subject) : 'class'}
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
                  onBeforeSend={async (messageBody, selectedSenderId) => {
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
