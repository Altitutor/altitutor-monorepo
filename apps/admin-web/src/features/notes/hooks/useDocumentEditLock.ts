import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { useCurrentStaff } from '@/shared/hooks';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';
import { documentEditLocksApi, type NoteDocumentEditLock } from '../api/documentEditLocks';
import { notesKeys } from '../api/queryKeys';

const LOCK_STALE_MS = 45_000;
const HEARTBEAT_MS = 15_000;

const getLockDetailKey = (noteId: string) => notesKeys.editLock(noteId);

function createLockToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isDocumentEditLockActive(lock: NoteDocumentEditLock | null | undefined) {
  if (!lock) return false;
  return Date.now() - new Date(lock.updated_at).getTime() < LOCK_STALE_MS;
}

export function getDocumentEditLockOwnerName(lock: NoteDocumentEditLock | null | undefined) {
  const staff = lock?.locked_by_staff;
  if (!staff) return 'another user';
  return `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || 'another user';
}

export function useDocumentEditLock(noteId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const lockTokenRef = useRef<string>(createLockToken());

  useSupabaseRealtimeInvalidation({
    table: 'note_document_edit_locks',
    queryKey: noteId ? notesKeys.editLock(noteId) : notesKeys.all,
    detailKey: getLockDetailKey,
    enabled: enabled && !!noteId,
  });

  const query = useQuery({
    queryKey: noteId ? notesKeys.editLock(noteId) : notesKeys.editLock(''),
    queryFn: () => documentEditLocksApi.get(noteId!),
    enabled: enabled && !!noteId,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });

  const acquireMutation = useMutation({
    mutationFn: async () => {
      if (!noteId || !currentStaff?.id) {
        throw new Error('Must be logged in to edit this document');
      }
      return documentEditLocksApi.acquire({
        noteId,
        staffId: currentStaff.id,
        lockToken: lockTokenRef.current,
      });
    },
    onSuccess: (lock) => {
      queryClient.setQueryData(notesKeys.editLock(lock.note_id), lock);
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not enter edit mode',
        description: error.message || 'Failed to lock this document for editing.',
        variant: 'destructive',
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      await documentEditLocksApi.release({
        noteId,
        lockToken: lockTokenRef.current,
      });
    },
    onSuccess: () => {
      if (noteId) {
        queryClient.invalidateQueries({ queryKey: notesKeys.editLock(noteId) });
      }
    },
  });

  const lock = query.data ?? null;
  const isActive = isDocumentEditLockActive(lock);
  const isHeldByThisWindow = Boolean(
    isActive && lock?.lock_token === lockTokenRef.current
  );
  const isHeldByAnotherWindow = Boolean(isActive && !isHeldByThisWindow);

  useEffect(() => {
    if (!noteId || !isHeldByThisWindow) return;

    const heartbeat = () => {
      void documentEditLocksApi
        .heartbeat({ noteId, lockToken: lockTokenRef.current })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: notesKeys.editLock(noteId) });
        });
    };

    const interval = window.setInterval(heartbeat, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [isHeldByThisWindow, noteId, queryClient]);

  useEffect(() => {
    const lockToken = lockTokenRef.current;
    return () => {
      if (!noteId) return;
      void documentEditLocksApi.release({
        noteId,
        lockToken,
      });
    };
  }, [noteId]);

  return useMemo(
    () => ({
      ...query,
      lock,
      currentStaff,
      lockToken: lockTokenRef.current,
      isActive,
      isHeldByThisWindow,
      isHeldByAnotherWindow,
      acquire: acquireMutation.mutateAsync,
      release: releaseMutation.mutateAsync,
      isAcquiring: acquireMutation.isPending,
      isReleasing: releaseMutation.isPending,
    }),
    [
      acquireMutation.isPending,
      acquireMutation.mutateAsync,
      currentStaff,
      isActive,
      isHeldByAnotherWindow,
      isHeldByThisWindow,
      lock,
      query,
      releaseMutation.isPending,
      releaseMutation.mutateAsync,
    ]
  );
}
