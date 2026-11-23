'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@altitutor/ui';
import { usePanelMediaQuery } from '@/shared/hooks/usePanelMediaQuery';
import { cn } from '@/shared/utils';

type AdminPageActionButtonProps = Omit<ButtonProps, 'children' | 'size'> & {
  icon: React.ReactNode;
  label: string;
  trailingIcon?: React.ReactNode;
  compact?: boolean;
  createShortcut?: boolean;
};

export const AdminPageActionButton = React.forwardRef<HTMLButtonElement, AdminPageActionButtonProps>(
  ({ className, icon, label, trailingIcon, compact, createShortcut = false, variant = 'default', ...props }, ref) => {
    const inlineLabel = usePanelMediaQuery('(min-width: 520px)');
    const iconOnly = compact ?? !inlineLabel;
    return (
    <Button
      ref={ref}
      size={iconOnly ? "icon" : "sm"}
      variant={variant}
      data-shortcut-create={createShortcut ? "" : undefined}
      className={cn("h-8 shrink-0 rounded-full", iconOnly && "w-8 px-0", className)}
      aria-label={props['aria-label'] ?? label}
      {...props}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
      {!iconOnly && trailingIcon}
    </Button>
    );
  }
);
AdminPageActionButton.displayName = 'AdminPageActionButton';
