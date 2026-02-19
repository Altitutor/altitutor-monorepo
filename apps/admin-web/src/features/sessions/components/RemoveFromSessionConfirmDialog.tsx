'use client';

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
import { Loader2 } from 'lucide-react';

type RemoveFromSessionConfirmDialogProps = {
  isOpen: boolean;
  entityType: 'student' | 'staff';
  entityName: string;
  sessionTitle: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveFromSessionConfirmDialog({
  isOpen,
  entityType,
  entityName,
  sessionTitle,
  isPending = false,
  onCancel,
  onConfirm,
}: RemoveFromSessionConfirmDialogProps) {
  const title = `Remove ${entityType === 'student' ? 'Student' : 'Staff'} from session?`;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove {entityName} from {sessionTitle} only.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Removing...
              </span>
            ) : (
              'Remove'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
