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

interface DiscontinueStudentConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  /** Called when user confirms. Should return true on success (dialog will close), false otherwise */
  onConfirm: () => Promise<boolean>;
  isDiscontinuing: boolean;
}

/**
 * Confirmation dialog shown before discontinuing a student.
 * Use in ViewStudentModal, StudentsTable, and student detail page.
 */
export function DiscontinueStudentConfirmDialog({
  isOpen,
  onOpenChange,
  studentName,
  onConfirm,
  isDiscontinuing,
}: DiscontinueStudentConfirmDialogProps) {
  const displayName = studentName || 'this student';

  const handleConfirm = async () => {
    const success = await onConfirm();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discontinue student?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to discontinue {displayName}? This will change their status to
            discontinued. You can re-enroll them later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDiscontinuing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDiscontinuing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDiscontinuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Discontinuing...
              </>
            ) : (
              'Discontinue'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
