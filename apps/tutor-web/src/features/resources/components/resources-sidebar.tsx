'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

export type ResourceSidebarItem = {
  key: string;
  label: string;
  /** Omit to render as a non-interactive section header */
  href?: string;
  active?: boolean;
  children?: ResourceSidebarItem[];
};

function hasActiveDescendant(item: ResourceSidebarItem): boolean {
  return Boolean(item.children?.some((child) => child.active || hasActiveDescendant(child)));
}

function SidebarTreeItem({ item, depth = 0 }: { item: ResourceSidebarItem; depth?: number }) {
  const hasChildren = Boolean(item.children?.length);
  const activeDescendant = hasActiveDescendant(item);
  const [expanded, setExpanded] = useState(item.active || activeDescendant || depth === 0);

  useEffect(() => {
    if (item.active || activeDescendant) {
      setExpanded(true);
    }
  }, [activeDescendant, item.active]);

  return (
    <li className="rounded-lg">
      <div className="flex items-center gap-1 py-0.5 pl-0 pr-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={expanded}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300 hover:bg-muted/80"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-out', expanded && 'rotate-90')} />
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-hidden
            className="flex h-6 w-6 shrink-0 cursor-default items-center justify-center rounded-md opacity-0"
          />
        )}

        {item.href ? (
          <Link
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-300 ease-out',
              item.active
                ? 'bg-brand-darkBlue text-white shadow-sm hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90'
                : 'hover:bg-muted/80',
            )}
          >
            <span className="block truncate" title={item.label}>
              {item.label}
            </span>
          </Link>
        ) : (
          <span
            className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground"
            title={item.label}
          >
            {item.label}
          </span>
        )}
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-3">
              <ul className="space-y-1">
                {item.children?.map((child) => (
                  <SidebarTreeItem key={child.key} item={child} depth={depth + 1} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ResourcesSidebar({
  title,
  items,
  className,
}: {
  title: string;
  items: ResourceSidebarItem[];
  className?: string;
}) {
  return (
    <aside className={cn(tutorCardCn(), 'w-full py-4 pl-2 pr-3 lg:w-72', className)}>
      <h3 className="mb-3 px-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <SidebarTreeItem key={item.key} item={item} />
        ))}
      </ul>
    </aside>
  );
}
