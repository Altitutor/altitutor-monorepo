'use client';

import { useState, useEffect } from 'react';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { MessageSquare, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import { useContactIdForRelated } from '@/features/messages/hooks/useContactIdForRelated';

export type NotifyRecipient = {
  type: 'student' | 'parent' | 'staff';
  id: string;
  label: string;
  value?: string;
};

export interface BookingNotifyMessageScreenProps {
  successMessage: string;
  recipients: NotifyRecipient[];
  defaultDraft?: string;
}

export function BookingNotifyMessageScreen({
  successMessage,
  recipients,
  defaultDraft = '',
}: BookingNotifyMessageScreenProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<NotifyRecipient | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>(defaultDraft);

  const contactRelatedId =
    selectedRecipient?.type === 'parent' ? selectedRecipient.id : selectedRecipient?.id;
  const contactType = selectedRecipient?.type ?? 'student';
  const { data: contactId, isLoading: contactLoading } = useContactIdForRelated(
    contactRelatedId,
    contactType,
    !!selectedRecipient
  );

  useEffect(() => {
    if (recipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(recipients[0]);
    }
  }, [recipients, selectedRecipient]);

  useEffect(() => {
    if (defaultDraft && selectedRecipient) {
      setComposerDraft(defaultDraft);
    }
  }, [defaultDraft, selectedRecipient]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Success Indicator */}
      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 flex-shrink-0">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
      </div>

      {/* Message Section */}
      {selectedRecipient && recipients.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Message</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    <span className="text-xs">{selectedRecipient.label}</span>
                    {selectedRecipient.value && (
                      <span className="text-xs text-muted-foreground ml-1">
                        • {selectedRecipient.value}
                      </span>
                    )}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {recipients.map((option, index) => (
                    <DropdownMenuItem
                      key={`${option.type}-${option.id}-${index}`}
                      onClick={() => setSelectedRecipient(option)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{option.label}</span>
                          {option.value && (
                            <span className="text-xs text-muted-foreground truncate">
                              {option.value}
                            </span>
                          )}
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

          {contactLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Loading contact...</div>
            </div>
          ) : contactId ? (
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
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  No contact found for {selectedRecipient.label}. Please add contact information
                  before sending.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            No recipients available to message.
          </p>
        </div>
      )}
    </div>
  );
}
