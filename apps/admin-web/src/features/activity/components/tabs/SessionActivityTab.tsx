'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityTabLayout } from '../ActivityTabLayout';
import { useSessionActivity, useFormResponseDialog } from '../../hooks';
import { useEntityActivityNoteComposer } from '../../hooks/useEntityActivityNoteComposer';
import { activityKeys } from '../../hooks';
import { Button, SearchableSelect } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { SessionFormResponseDialog } from '@/features/forms/components/SessionFormResponseDialog';
import { FormResponseDialog } from '@/features/feedback/components/FormResponseDialog';

interface SessionActivityTabProps {
  sessionId: string;
  isOpen?: boolean;
}

type FormOption = { id: string; name: string };

export function SessionActivityTab({ sessionId, isOpen = true }: SessionActivityTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSessionActivity(sessionId, isOpen);
  const [sessionForms, setSessionForms] = useState<FormOption[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const { selectedResponse, openFormResponse, closeFormResponse } = useFormResponseDialog();
  const composerProps = useEntityActivityNoteComposer({
    targetType: 'sessions',
    targetId: sessionId,
    activityQueryKey: activityKeys.session(sessionId),
  });

  const invalidateActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) });
  }, [queryClient, sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setFormsLoading(true);
    setFormsError(null);
    void fetch(`/api/forms/session-responses?sessionId=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
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

  return (
    <ActivityTabLayout
      showComposer
      composerProps={composerProps}
      header={(
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
      )}
      data={data}
      isLoading={isLoading}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      onOpenFormResponse={openFormResponse}
      footer={(
        <>
          <FormResponseDialog
            response={selectedResponse}
            onClose={closeFormResponse}
            onUpdated={invalidateActivity}
            onDeleted={invalidateActivity}
          />
          <SessionFormResponseDialog
            sessionId={sessionId}
            formId={selectedFormId}
            open={Boolean(selectedFormId)}
            onOpenChange={(open) => {
              if (!open) setSelectedFormId(null);
            }}
            onSaved={invalidateActivity}
          />
        </>
      )}
    />
  );
}
