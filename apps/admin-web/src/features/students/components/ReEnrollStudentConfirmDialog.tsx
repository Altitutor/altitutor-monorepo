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

interface ReEnrollStudentConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  /** Called when user confirms. Should return true on success (dialog will close), false otherwise */
  onConfirm: () => Promise<boolean>;
  isReEnrolling: boolean;
}

/**
 * Confirmation dialog shown before re-enrolling a discontinued student.
 */
export function ReEnrollStudentConfirmDialog({
  isOpen,
  onOpenChange,
  studentName,
  onConfirm,
  isReEnrolling,
}: ReEnrollStudentConfirmDialogProps) {
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
          <AlertDialogTitle>Re-enroll student?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to re-enroll {displayName}? This will change their status back to
            active so they can be booked and enrolled in classes again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReEnrolling}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isReEnrolling}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReEnrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Re-enrolling...
              </>
            ) : (
              'Re-enroll'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
