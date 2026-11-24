'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
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
      className={cn('flex items-center gap-2 text-sm text-muted-foreground mb-4', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex min-w-0 items-center gap-2">
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className={cn("truncate text-left hover:text-foreground hover:underline", isLast && "font-medium text-foreground")}
                title={item.label}
                data-recent-page-title={isLast || undefined}
              >
                {item.label}
              </button>
            ) : item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast && "font-medium text-foreground")} title={item.label} data-recent-page-title={isLast || undefined}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
