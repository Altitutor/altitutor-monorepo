'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
  WIZARD_DIALOG_HEIGHT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import {
  tutorBtnIconOutline,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual';

export function TutorDialogShell({
  open,
  onOpenChange,
  title,
  description,
  headerActions,
  footer,
  size = 'default',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'compact';
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const compact = size === 'compact';

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setExpanded(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        hideCloseButton
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 [&>button]:hidden',
          compact ? 'sm:max-w-md' : 'md:max-w-4xl',
          tutorDialogContentClass,
          EXPANDABLE_DIALOG_TRANSITION,
          expanded ? EXPANDED_DIALOG_CONTENT_CLASS : compact ? 'sm:h-auto' : WIZARD_DIALOG_HEIGHT_CLASS,
        )}
      >
        <div className={cn('flex-shrink-0', tutorDialogHeaderStrip)}>
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Close"
                  className={tutorBtnIconOutline}
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate">{title}</DialogTitle>
                  {description ? (
                    <DialogDescription className="mt-1">{description}</DialogDescription>
                  ) : (
                    <DialogDescription className="sr-only">{title}</DialogDescription>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((current) => !current)} />
                {headerActions}
              </div>
            </div>
          </DialogHeader>
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 p-6 pt-4',
            compact ? 'overflow-y-auto' : 'overflow-hidden',
          )}
        >
          {children}
        </div>
        {footer ? (
          <DialogFooter
            className={cn(
              'flex-shrink-0 flex-row justify-end gap-2 px-6 py-4 sm:justify-end',
              tutorDialogFooterStrip,
            )}
          >
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
