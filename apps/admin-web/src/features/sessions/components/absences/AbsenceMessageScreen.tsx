'use client';

import { useState, useEffect } from 'react';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { MessageSquare, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/shared/utils';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { useCurrentStaff } from '@/shared/hooks';
import { useParentsForStudent } from '@/features/enrollments/hooks/useParentsForStudent';
import type { Tables } from '@altitutor/shared';
import type { AbsenceDecision, RescheduleSession, StudentSession } from '../../types/absence';

function buildAbsenceMessageTemplate(params: {
  recipientName: string;
  senderName: string;
  decisions: AbsenceDecision[];
  sessions: StudentSession[];
  rescheduledSessionsMap: Map<string, RescheduleSession>;
}): string {
  const { recipientName, senderName, decisions, sessions, rescheduledSessionsMap } = params;

  const lines: string[] = [];
  for (const decision of decisions) {
    const session = sessions.find((s) => s.id === decision.sessionId);
    if (!session) continue;

    const sessionDateTime = session.start_at ? formatDateTime(session.start_at) : '';
    const subjectShort = session.subject ? (session.subject.short_name ?? session.subject.long_name ?? session.subject.name ?? '') : '-';

    let actionText: string;
    if (decision.action === 'credit') {
      actionText = 'credit has been applied to your account, so you will not be charged for this session';
    } else if (decision.action === 'reschedule' && decision.targetSessionId) {
      const targetSession = rescheduledSessionsMap.get(decision.targetSessionId);
      const newDateTime = targetSession?.start_at ? formatDateTime(targetSession.start_at) : '';
      actionText = `rescheduled to ${newDateTime}`;
    } else {
      actionText = '';
    }

    lines.push(`- ${sessionDateTime} ${subjectShort}: ${actionText}`);
  }

  return `Hi ${recipientName},

I have processed the following absences for you:
${lines.join('\n')}

Kind regards,

${senderName}, Altitutor Admin`;
}

type RecipientOption = { type: 'student' | 'parent'; id?: string; label: string; value: string };

interface AbsenceMessageScreenProps {
  selectedStudent: Tables<'students'> | null;
  decisions: AbsenceDecision[];
  selectedSessionsArray: StudentSession[];
  rescheduledSessionsMap: Map<string, RescheduleSession>;
}

export function AbsenceMessageScreen({
  selectedStudent,
  decisions,
  selectedSessionsArray,
  rescheduledSessionsMap,
}: AbsenceMessageScreenProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientOption | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const { data: parentsData = [] } = useParentsForStudent(selectedStudent?.id ?? undefined, !!selectedStudent?.id);
  const parents = parentsData;
  const { data: currentStaff } = useCurrentStaff();

  // Build recipient options (student phone and parent phones only)
  useEffect(() => {
    if (!selectedStudent) return;

    const recipients: RecipientOption[] = [];

    if (selectedStudent.phone) {
      recipients.push({
        type: 'student',
        label: 'Student Phone',
        value: selectedStudent.phone,
      });
    }

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

  // Pre-populate message with absence template when recipient changes
  useEffect(() => {
    if (!selectedRecipient || !selectedStudent || !currentStaff || decisions.length === 0) return;

    const recipientName =
      selectedRecipient.type === 'parent'
        ? parents.find((p) => p.id === selectedRecipient.id)?.first_name || 'there'
        : selectedStudent.first_name || 'there';

    const senderName = `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim();

    const template = buildAbsenceMessageTemplate({
      recipientName,
      senderName,
      decisions,
      sessions: selectedSessionsArray,
      rescheduledSessionsMap,
    });

    setComposerDraft(template);
  }, [
    selectedRecipient,
    selectedStudent,
    currentStaff,
    decisions,
    selectedSessionsArray,
    rescheduledSessionsMap,
    parents,
  ]);

  const recipientOptions: RecipientOption[] = [];
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
    <div className="flex flex-col h-full min-h-0">
      {/* Success Indicator */}
      {selectedStudent && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Successfully logged absences for{' '}
            <span className="font-semibold">
              {selectedStudent.first_name} {selectedStudent.last_name}
            </span>
            {' '}({decisions.length} session{decisions.length !== 1 ? 's' : ''} processed)
          </p>
        </div>
      )}

      {/* Message Section */}
      {selectedRecipient && recipientOptions.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Message</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7">
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
                      {selectedRecipient?.type === option.type && selectedRecipient?.id === option.id && (
                        <Check className="h-4 w-4 ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

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
                  onBeforeSend={async () => null}
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
