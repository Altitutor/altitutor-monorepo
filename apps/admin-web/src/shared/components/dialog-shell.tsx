'use client';

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
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
  headerExtra,
  defaultExpanded = false,
  fillHeight = false,
  showExpand,
  hideHeader = false,
  contentClassName,
  bodyClassName,
  dialogContentProps,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  /** Rendered below the title row inside the header (e.g. wizard progress). */
  headerExtra?: ReactNode;
  defaultExpanded?: boolean;
  /** Tall desktop layout (~90vh). Use for large or multi-step dialogs. */
  fillHeight?: boolean;
  /** Defaults to fillHeight when omitted. */
  showExpand?: boolean;
  /** Omit the built-in header when children provide their own chrome (e.g. entity detail views). */
  hideHeader?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
  dialogContentProps?: Omit<ComponentPropsWithoutRef<typeof DialogContent>, 'className' | 'children'>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const shouldShowExpand = showExpand ?? fillHeight;

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
        data-admin-dialog-fill-height={fillHeight ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-0 overflow-hidden p-0 sm:p-0 md:max-w-2xl [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
          contentClassName,
        )}
        {...dialogContentProps}
      >
        {hideHeader ? <DialogTitle className="sr-only">{title}</DialogTitle> : null}
        {!hideHeader ? (
          <DialogHeader className="shrink-0 border-b bg-card">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Button type="button" variant="outline" size="icon" onClick={onClose} className="shrink-0">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                  <div className="min-w-0 flex-1">
                    <DialogTitle>{title}</DialogTitle>
                    {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {shouldShowExpand ? (
                    <ExpandButton expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
                  ) : null}
                  {headerActions}
                </div>
              </div>
            </div>
            {headerExtra}
          </DialogHeader>
        ) : null}

        <div
          className={cn(
            'px-6 py-4',
            fillHeight ? 'min-h-0 flex-1 overflow-y-auto' : undefined,
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <DialogFooter className="shrink-0 border-t bg-card px-6 py-4 sm:justify-end">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
