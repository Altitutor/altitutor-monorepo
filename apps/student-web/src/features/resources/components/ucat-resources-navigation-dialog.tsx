'use client';

import React, { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@altitutor/ui/components/alert-dialog';
import { getUcatSessionsUrl } from '../lib/ucat-resources';

export function UcatResourcesNavigationDialog({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    const ucatWindow = window.open(getUcatSessionsUrl(), '_blank', 'noopener,noreferrer');
    if (ucatWindow) ucatWindow.opener = null;
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue to UCAT?</AlertDialogTitle>
          <AlertDialogDescription>
            UCAT resources are available in the Altitutor UCAT app. Continuing will open your
            UCAT Sessions page in a new tab. You may be asked to sign in first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay here</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Open UCAT</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
