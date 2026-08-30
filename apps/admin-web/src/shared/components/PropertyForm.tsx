import type { HTMLAttributes, ReactNode } from 'react';
import { Label } from '@altitutor/ui';
import { cn } from '@/shared/utils';

type PropertyFormProps = HTMLAttributes<HTMLDivElement>;

interface PropertyFormRowProps {
  children: ReactNode;
  htmlFor?: string;
  label: ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

/**
 * Standard label/value layout for editable entity properties in Admin Web.
 */
export function PropertyForm({ className, ...props }: PropertyFormProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-4 gap-y-3',
        className,
      )}
      {...props}
    />
  );
}

export function PropertyFormRow({
  children,
  htmlFor,
  label,
  labelClassName,
  valueClassName,
}: PropertyFormRowProps) {
  const labelClasses = cn('self-center text-sm font-medium', labelClassName);

  return (
    <>
      {htmlFor ? (
        <Label className={labelClasses} htmlFor={htmlFor}>
          {label}
        </Label>
      ) : (
        <div className={labelClasses}>{label}</div>
      )}
      <div className={cn('min-w-0 [&>*]:w-full', valueClassName)}>{children}</div>
    </>
  );
}
