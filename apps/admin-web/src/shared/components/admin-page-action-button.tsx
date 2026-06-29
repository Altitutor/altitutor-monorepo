'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@altitutor/ui';

type AdminPageActionButtonProps = Omit<ButtonProps, 'children' | 'size'> & {
  icon: React.ReactNode;
  label: string;
  trailingIcon?: React.ReactNode;
};

export const AdminPageActionButton = React.forwardRef<HTMLButtonElement, AdminPageActionButtonProps>(
  ({ className, icon, label, trailingIcon, ...props }, ref) => (
    <Button
      ref={ref}
      className={['size-10 px-0 sm:size-auto sm:px-4', className].filter(Boolean).join(' ')}
      aria-label={props['aria-label'] ?? label}
      {...props}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {trailingIcon ? <span className="hidden sm:inline-flex">{trailingIcon}</span> : null}
    </Button>
  )
);
AdminPageActionButton.displayName = 'AdminPageActionButton';
