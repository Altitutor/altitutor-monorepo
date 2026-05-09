'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';

export type ResourceBreadcrumbItem = {
  label: string;
  href?: string;
};

export function ResourcesBreadcrumb({ items, className }: { items: ResourceBreadcrumbItem[]; className?: string }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors duration-300 hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-4 w-4" /> : null}
          </div>
        );
      })}
    </nav>
  );
}
