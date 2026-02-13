'use client';

import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  isSubmitting: boolean;
}

export function WelcomeModal({
  open,
  onOpenChange,
  onAcknowledge,
  isSubmitting,
}: WelcomeModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Welcome to Altitutor Student</AlertDialogTitle>
          <AlertDialogDescription>
            This quick welcome is shown once when you first log in. You can now explore your dashboard,
            classes, resources, billing, and profile from the sidebar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAcknowledge} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Get Started'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
