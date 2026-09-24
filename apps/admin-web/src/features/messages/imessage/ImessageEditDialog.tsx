'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { AdminDialogShell } from '@/shared/components';
import { useCurrentStaff } from '@/shared/hooks';
import { MessageTemplatesPicker } from '../components/MessageTemplatesPicker';
import { ComposerVariablesDropdown } from '../components/ComposerVariablesDropdown';
import { useContactForTemplate } from '../api/queries';
import { useContactClasses } from '../hooks/useContactClasses';
import { useResponsiveButtons } from '../hooks/useResponsiveButtons';
import { useVariableReplacement } from '../hooks/useVariableReplacement';
import {
  IMESSAGE_EDIT_WINDOW_MS,
  formatImessageWindowRemaining,
  imessageWindowRemainingMs,
  messageSentAtMs,
} from './imessageWindows';

interface ImessageEditDialogProps {
  open: boolean;
  onClose: () => void;
  initialBody: string;
  contactId?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  pending?: boolean;
  onSave: (text: string) => void | Promise<void>;
}

export function ImessageEditDialog({
  open,
  onClose,
  initialBody,
  contactId,
  sentAt,
  createdAt,
  pending = false,
  onSave,
}: ImessageEditDialogProps) {
  const [text, setText] = useState(initialBody);
  const [variablesMenuOpen, setVariablesMenuOpen] = useState(false);
  const [isGeneratingTokens, setIsGeneratingTokens] = useState(false);
  const [now, setNow] = useState(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRowRef = useRef<HTMLDivElement>(null);
  const canExpand = useResponsiveButtons(buttonRowRef);
  const { data: currentStaff } = useCurrentStaff();
  const { data: contactData } = useContactForTemplate(contactId ?? null);
  const { studentHasClasses, staffHasClasses } = useContactClasses(contactData ?? null);
  const { getVariableValue, getAvailableVariables, getParentStudents } = useVariableReplacement(
    contactData ?? null,
    studentHasClasses,
    staffHasClasses,
    currentStaff ?? undefined,
    setIsGeneratingTokens,
  );

  useEffect(() => {
    if (open) {
      setText(initialBody);
      setVariablesMenuOpen(false);
      setNow(Date.now());
    }
  }, [open, initialBody]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    const maxHeight = 280;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(next, 120)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [open, text]);

  const sentAtMs = messageSentAtMs(sentAt, createdAt);
  const remainingMs = imessageWindowRemainingMs(sentAtMs, IMESSAGE_EDIT_WINDOW_MS, now);
  const withinWindow = remainingMs > 0;

  const handleTemplateSelect = async (template: Tables<'message_templates'>) => {
    let content = template.content;
    const placeholders = [...content.matchAll(/\{([a-z0-9_]+)\}/gi)].map((match) => match[1]);
    const unique = [...new Set(placeholders)];
    for (const name of unique) {
      const value = await getVariableValue(name);
      content = content.split(`{${name}}`).join(value);
    }
    setText(content);
    textareaRef.current?.focus();
  };

  const handleInsertVariable = async (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const replacementValue = await getVariableValue(variable);
    const next = text.substring(0, start) + replacementValue + text.substring(end);
    setText(next);
    setVariablesMenuOpen(false);
    window.setTimeout(() => {
      const position = start + replacementValue.length;
      textarea.focus();
      textarea.setSelectionRange(position, position);
    }, 0);
  };

  const handleSave = async () => {
    if (!withinWindow || !text.trim() || pending) return;
    await onSave(text.trimEnd());
  };

  return (
    <AdminDialogShell
        fillHeight
      open={open}
      onClose={onClose}
      title="Edit iMessage"
      subtitle={
        withinWindow
          ? `Apple allows edits for 15 minutes after sending (${formatImessageWindowRemaining(remainingMs)}). Up to 5 edits per message.`
          : 'The Apple edit window has expired for this message.'
      }
      contentClassName="md:max-w-2xl"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!withinWindow || !text.trim() || pending}
            onClick={() => void handleSave()}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Queue edit
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[120px] max-h-[280px] resize-none rounded-md border bg-background px-3 py-2 text-sm whitespace-pre-wrap"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message"
          disabled={!withinWindow || pending}
          rows={5}
        />
        <div ref={buttonRowRef} className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <MessageTemplatesPicker
              onSelect={(template) => void handleTemplateSelect(template)}
              disabled={!withinWindow || pending || isGeneratingTokens}
              expanded={canExpand}
            />
            {isGeneratingTokens && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <ComposerVariablesDropdown
            availableVariables={getAvailableVariables()}
            parentStudents={getParentStudents()}
            studentHasClasses={studentHasClasses}
            contactType={contactData?.contact_type}
            open={variablesMenuOpen}
            onOpenChange={setVariablesMenuOpen}
            onInsertVariable={handleInsertVariable}
            canExpand={canExpand}
            disabled={!withinWindow || pending || isGeneratingTokens}
          />
        </div>
      </div>
    </AdminDialogShell>
  );
}
