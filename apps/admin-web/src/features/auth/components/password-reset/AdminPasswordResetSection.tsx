'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  SearchableSelect,
  useToast,
} from '@altitutor/ui';
import { Check, Copy, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Composer } from '@/features/messages/components/Composer';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { getContactIdByRelatedId } from '@/features/messages/api/queries';
import { AdminDialogShell } from '@/shared/components';

type ResetUserType = 'student' | 'tutor' | 'admin';
type ResetAction = 'send-email' | 'send-text' | 'copy-link' | 'manual-reset';

type ResetRecipient = {
  type: 'student' | 'staff' | 'parent';
  id: string;
  label: string;
  value?: string | null;
};

type ResetOption = {
  value: ResetAction;
  label: string;
  description: string;
};

const RESET_OPTIONS: ResetOption[] = [
  {
    value: 'send-email',
    label: 'Send reset email',
    description: 'Email the standard password reset link.',
  },
  {
    value: 'send-text',
    label: 'Send reset text',
    description: 'Open a message composer with the reset link.',
  },
  {
    value: 'copy-link',
    label: 'Copy password reset link',
    description: 'Copy a shareable password reset link.',
  },
  {
    value: 'manual-reset',
    label: 'Manually reset password',
    description: 'Set the account password directly.',
  },
];

interface AdminPasswordResetSectionProps {
  userId: string | null;
  email: string | null;
  userType: ResetUserType;
  displayName: string;
  recipients: ResetRecipient[];
}

function buildDefaultMessage(displayName: string, resetLink: string) {
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${firstName}, use this link to reset your Altitutor password: ${resetLink}`;
}

async function postPasswordReset<T>(
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Password reset request failed');
  }
  return payload as T;
}

export function AdminPasswordResetSection({
  userId,
  email,
  userType,
  displayName,
  recipients,
}: AdminPasswordResetSectionProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<ResetOption | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualPassword, setManualPassword] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<ResetRecipient | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const phoneRecipients = useMemo(
    () => recipients.filter((recipient) => Boolean(recipient.value)),
    [recipients]
  );

  useEffect(() => {
    if (!selectedRecipient || !textDialogOpen) {
      setContactId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextContactId = await getContactIdByRelatedId(
          selectedRecipient.id,
          selectedRecipient.type
        );
        if (!cancelled) setContactId(nextContactId);
      } catch (error) {
        if (!cancelled) setContactId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRecipient, textDialogOpen]);

  const basePayload = () => {
    if (!userId || !email) {
      throw new Error('This person needs a linked account and email address first.');
    }
    return { userId, email, userType };
  };

  const generateLink = async () => {
    const payload = basePayload();
    const result = await postPasswordReset<{ link: string }>({
      ...payload,
      action: 'generate-link',
    });
    return result.link;
  };

  const sendEmail = async () => {
    const payload = basePayload();
    await postPasswordReset<{ ok: true }>({
      ...payload,
      action: 'send-email',
    });
    toast({
      title: 'Password reset email sent',
      description: `A reset link was sent to ${email}.`,
    });
  };

  const copyLink = async () => {
    const link = await generateLink();
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Password reset link copied',
      description: 'The link is ready to share.',
    });
  };

  const openTextMessage = async () => {
    if (phoneRecipients.length === 0) {
      throw new Error('No phone number is available for text reset.');
    }
    const link = await generateLink();
    const recipient = selectedRecipient ?? phoneRecipients[0];
    setSelectedRecipient(recipient);
    setDraft(buildDefaultMessage(displayName, link));
    setTextDialogOpen(true);
  };

  const manualReset = async () => {
    const payload = basePayload();
    await postPasswordReset<{ ok: true }>({
      ...payload,
      action: 'manual-reset',
      password: manualPassword,
    });
    setManualPassword('');
    setManualDialogOpen(false);
    toast({
      title: 'Password updated',
      description: `${displayName}'s password was reset.`,
    });
  };

  const runSelectedOption = async () => {
    if (!selectedOption) return;

    if (selectedOption.value === 'manual-reset') {
      setManualDialogOpen(true);
      return;
    }

    try {
      setIsRunning(true);
      if (selectedOption.value === 'send-email') {
        await sendEmail();
      } else if (selectedOption.value === 'copy-link') {
        await copyLink();
      } else if (selectedOption.value === 'send-text') {
        await openTextMessage();
      }
    } catch (error) {
      toast({
        title: 'Password reset failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Password reset</h3>
        <p className="text-sm text-muted-foreground">
          Send a reset link, share one manually, or set a new password for this account.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <SearchableSelect<ResetOption>
          items={RESET_OPTIONS}
          value={selectedOption}
          onValueChange={setSelectedOption}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          getItemValue={(item) => `${item.label} ${item.description}`}
          placeholder="Choose reset action..."
          searchPlaceholder="Search reset actions..."
          emptyMessage="No reset actions found."
          triggerClassName="w-full sm:w-[280px] justify-between"
          renderItem={(item, isSelected) => (
            <div className="flex w-full items-start gap-2">
              <Check className={`mt-0.5 h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </div>
          )}
        />

        <Button
          type="button"
          onClick={runSelectedOption}
          disabled={isRunning || !selectedOption || !userId || !email}
          className="w-fit"
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : selectedOption?.value === 'copy-link' && copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : selectedOption?.value === 'send-text' ? (
            <MessageSquare className="mr-2 h-4 w-4" />
          ) : selectedOption?.value === 'manual-reset' ? (
            <ShieldCheck className="mr-2 h-4 w-4" />
          ) : selectedOption?.value === 'copy-link' ? (
            <Copy className="mr-2 h-4 w-4" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {selectedOption?.value === 'copy-link' && copied ? 'Copied' : 'Run'}
        </Button>
      </div>

      {!email && (
        <p className="text-sm text-orange-600">
          No email address is set. Add an email before sending or generating reset links.
        </p>
      )}
      {!userId && (
        <p className="text-sm text-orange-600">
          No linked user account exists yet. Send an invite before resetting a password.
        </p>
      )}

      <AdminDialogShell
        open={manualDialogOpen}
        onClose={() => {
          setManualDialogOpen(false);
          setManualPassword('');
        }}
        title="Manually reset password"
        subtitle={`Set a new password for ${displayName}. This applies immediately.`}
        contentClassName="md:max-w-md"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setManualDialogOpen(false);
                setManualPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isRunning || manualPassword.length < 6}
              onClick={async () => {
                try {
                  setIsRunning(true);
                  await manualReset();
                } catch (error) {
                  toast({
                    title: 'Password reset failed',
                    description: error instanceof Error ? error.message : 'Please try again.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsRunning(false);
                }
              }}
            >
              {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </>
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="manual-password">New password</Label>
          <Input
            id="manual-password"
            type="password"
            value={manualPassword}
            onChange={(event) => setManualPassword(event.target.value)}
            placeholder="Enter a new password"
          />
        </div>
      </AdminDialogShell>

      <AdminDialogShell
        open={textDialogOpen}
        onClose={() => setTextDialogOpen(false)}
        title="Send reset text"
        subtitle="Review the reset message before sending."
        fillHeight
        contentClassName="md:max-w-3xl"
        headerExtra={(
          <div className="px-6 pb-4">
            <SearchableSelect<ResetRecipient>
              items={phoneRecipients}
              value={selectedRecipient}
              onValueChange={setSelectedRecipient}
              getItemId={(item) => item.id}
              getItemLabel={(item) => item.label}
              getItemValue={(item) => `${item.label} ${item.value ?? ''}`}
              placeholder="Choose recipient..."
              searchPlaceholder="Search recipients..."
              emptyMessage="No phone recipients found."
              triggerClassName="w-full justify-between"
              renderItem={(item, isSelected) => (
                <div className="flex w-full items-center gap-2">
                  <Check className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.value}</div>
                  </div>
                </div>
              )}
            />
          </div>
        )}
        bodyClassName="flex min-h-0 flex-1 flex-col p-0 overflow-hidden"
      >
        {contactId ? (
          <>
            <div className="min-h-0 flex-1 overflow-hidden">
              <MessageThread contactId={contactId} />
            </div>
            <div className="shrink-0 border-t">
              <Composer
                contactId={contactId}
                draft={draft}
                onDraftChange={setDraft}
                onDraftClear={() => setDraft('')}
                onBeforeSend={async () => null}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
            {selectedRecipient ? 'No messaging contact found for this recipient.' : 'Choose a recipient.'}
          </div>
        )}
      </AdminDialogShell>
    </div>
  );
}

export type { ResetRecipient, ResetUserType };
