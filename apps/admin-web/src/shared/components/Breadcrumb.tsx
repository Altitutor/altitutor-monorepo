'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';

interface BreadcrumbEntity {
  type: "student" | "parent" | "staff";
  id: string;
}

export function BreadcrumbName({ label, entity, onClick, className }: {
  label: string;
  entity?: BreadcrumbEntity;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-mention={entity ? "true" : undefined}
      data-type={entity?.type}
      data-id={entity?.id}
      data-label={entity ? label : undefined}
      onClick={onClick}
      className={cn("truncate text-left hover:text-foreground", className)}
      title={label}
    >
      {label}
    </button>
  );
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  entity?: BreadcrumbEntity;
  control?: ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  primary?: boolean;
}

export function Breadcrumb({ items, className, primary }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      data-primary-breadcrumb={primary || undefined}
      data-pane-title={items.at(-1)?.label}
      className={cn('flex items-center gap-2 text-sm text-muted-foreground mb-4', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex min-w-0 items-center gap-2">
            {item.control ?? (item.onClick ? (
              <BreadcrumbName
                label={item.label}
                onClick={item.onClick}
                entity={item.entity}
                className={isLast ? "font-medium text-foreground" : undefined}
              />
            ) : item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast && "font-medium text-foreground")} title={item.label}>
                {item.label}
              </span>
            ))}
            {!isLast && (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
