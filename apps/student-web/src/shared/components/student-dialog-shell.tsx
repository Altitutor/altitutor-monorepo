'use client';

import type { ReactNode } from 'react';
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
import { studentBtnIconOutline, studentModalFooter, studentModalShell } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export function StudentDialogShell({
  open,
  onOpenChange,
  title,
  description,
  headerActions,
  footer,
  children,
  contentClassName,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          'flex max-h-[min(92vh,900px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-6xl sm:p-0',
          studentModalShell,
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 bg-card px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Close"
                className={studentBtnIconOutline}
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle>{title}</DialogTitle>
                {description ? (
                  <DialogDescription className="mt-1">{description}</DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">{title}</DialogDescription>
                )}
              </div>
            </div>
            {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
          </div>
        </DialogHeader>

        <div className={cn('min-h-0 flex-1 overflow-hidden', bodyClassName)}>{children}</div>

        {footer ? (
          <DialogFooter className={cn(studentModalFooter, 'sm:justify-end')}>{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
