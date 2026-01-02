'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useBreadcrumbEntityName } from '@/shared/hooks/useBreadcrumbs';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  entityId?: string;
  entityType?: string | null;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function BreadcrumbItemComponent({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  const entityName = useBreadcrumbEntityName(item.entityId, item.entityType);
  const displayLabel = entityName || item.label;

  if (item.href && !isLast) {
    return (
      <Link
        href={item.href}
        className="hover:text-foreground transition-colors"
      >
        {displayLabel}
      </Link>
    );
  }

  return (
    <span className={isLast ? 'text-foreground font-medium' : ''}>
      {displayLabel}
    </span>
  );
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-2 text-sm text-muted-foreground mb-4', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            <BreadcrumbItemComponent item={item} isLast={isLast} />
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
