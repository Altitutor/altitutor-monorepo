'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import type { FormResponseDetail } from './FormResponseDialog';

export function DeleteFormResponseConfirmDialog({
  response,
  open,
  onOpenChange,
  onDeleted,
}: {
  response: FormResponseDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (responseId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteResponse = async () => {
    if (!response || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await fetch('/api/forms/responses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId: response.id }),
      });
      const json = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(json.error ?? 'Could not delete this response.');
      onOpenChange(false);
      onDeleted(response.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete this response.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (deleting) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete form response?</AlertDialogTitle>
          <AlertDialogDescription>
            This response will be removed from form responses and reports. This action cannot be undone from the admin app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              void deleteResponse();
            }}
          >
            {deleting ? 'Deleting...' : 'Delete response'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
