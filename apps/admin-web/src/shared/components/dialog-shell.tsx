'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@altitutor/ui';
import { X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

export function AdminDialogShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  defaultExpanded = false,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  defaultExpanded?: boolean;
  contentClassName?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (open) {
      setExpanded(defaultExpanded);
    } else {
      setExpanded(false);
    }
  }, [open, defaultExpanded]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 sm:p-0 md:max-w-2xl [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Button type="button" variant="outline" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle>{title}</DialogTitle>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
              {headerActions}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
