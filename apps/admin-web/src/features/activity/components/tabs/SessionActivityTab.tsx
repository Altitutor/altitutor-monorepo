'use client';

import { useState, useCallback, useEffect } from 'react';
import { ActivityFeed } from '../ActivityFeed';
import { ActivityNoteComposer } from '../ActivityNoteComposer';
import { useSessionActivity } from '../../hooks';
import { useCreateNote, notesKeys } from '@/shared/hooks/useNotes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { activityKeys } from '../../hooks';
import type { JSONContent } from '@tiptap/core';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { SessionFormResponseDialog } from '@/features/forms/components/SessionFormResponseDialog';
import { FormResponseDialog, type FormResponseDetail } from '@/features/feedback/components/FormResponseDialog';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

interface SessionActivityTabProps {
  sessionId: string;
  isOpen?: boolean;
}

type FormOption = { id: string; name: string };

export function SessionActivityTab({ sessionId, isOpen = true }: SessionActivityTabProps) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSessionActivity(sessionId, isOpen);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const [sessionForms, setSessionForms] = useState<FormOption[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<FormResponseDetail | null>(null);

  const openFormResponse = useCallback(async (responseId: string) => {
    if (!responseId) return;
    const response = await fetch(`/api/forms/responses?responseId=${encodeURIComponent(responseId)}`);
    const json = await response.json();
    if (response.ok) setSelectedResponse(json.responses?.[0] ?? null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setFormsLoading(true);
    setFormsError(null);
    void fetch(`/api/forms/session-responses?sessionId=${encodeURIComponent(sessionId)}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error ?? 'Could not load published forms.');
        return json.forms as FormOption[];
      })
      .then(setSessionForms)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setFormsError(reason instanceof Error ? reason.message : 'Could not load published forms.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setFormsLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, sessionId]);

  const handleSubmit = useCallback(async () => {
    if (!currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'sessions',
        targetId: sessionId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      queryClient.invalidateQueries({ queryKey: notesKeys.forTarget('sessions', sessionId) });
      queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) });
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, sessionId, createNoteMutation, queryClient]);

  return (
    <div className="h-full space-y-6">
      <div className="space-y-3">
        <div className="flex justify-end">
          <SearchableSelect
            items={sessionForms}
            value={null}
            onValueChange={(form) => {
              if (form) setSelectedFormId(form.id);
            }}
            getItemId={(form) => form.id}
            getItemLabel={(form) => form.name}
            loading={formsLoading}
            placeholder="Add form response"
            searchPlaceholder="Search published forms..."
            emptyMessage={formsError ?? 'No published forms found.'}
            trigger={(
              <Button type="button" variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add form response
              </Button>
            )}
            contentWidth="min(420px, calc(100vw - 2rem))"
          />
        </div>
        <ActivityNoteComposer content={newNoteContent} onChange={setNewNoteContent} onSubmit={handleSubmit} isSubmitting={createNoteMutation.isPending} canPost={Boolean(currentStaff)} />
      </div>

      <ActivityFeed
        data={data}
        isLoading={isLoading}
        error={error}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        onOpenFormResponse={openFormResponse}
      />
      <FormResponseDialog
        response={selectedResponse}
        onClose={() => setSelectedResponse(null)}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) })}
      />
      <SessionFormResponseDialog
        sessionId={sessionId}
        formId={selectedFormId}
        open={Boolean(selectedFormId)}
        onOpenChange={(open) => {
          if (!open) setSelectedFormId(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) })}
      />
    </div>
  );
}
