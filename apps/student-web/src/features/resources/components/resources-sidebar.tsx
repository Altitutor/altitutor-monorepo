'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';

export type ResourceSidebarItem = {
  key: string;
  label: string;
  href: string;
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
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md transition-all duration-200',
          item.active ? 'bg-brand-darkBlue text-white shadow-sm dark:bg-brand-lightBlue dark:text-brand-dark-bg' : 'hover:bg-muted',
          activeDescendant && !item.active && 'bg-muted/70'
        )}
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={expanded}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-background/70"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="h-7 w-7 shrink-0" />
        )}

        <Link
          href={item.href}
          className={cn(
            'min-w-0 flex-1 truncate py-2 pr-2 text-sm transition-colors',
            item.active ? 'font-medium' : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          {item.label}
        </Link>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <ul className="mt-1 space-y-1 overflow-hidden">
            {item.children?.map((child) => <SidebarTreeItem key={child.key} item={child} depth={depth + 1} />)}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function ResourcesSidebar({
  title,
  items,
  collapsed,
  onToggle,
}: {
  title: string;
  items: ResourceSidebarItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        'sticky top-6 self-start rounded-xl border bg-card shadow-sm transition-all duration-300',
        collapsed ? 'w-14 p-2' : 'w-full p-4 lg:w-72'
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed ? <h3 className="text-sm font-semibold">{title}</h3> : null}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar" className="shrink-0">
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      {!collapsed ? (
        <ul className="space-y-1">
          {items.map((item) => <SidebarTreeItem key={item.key} item={item} />)}
        </ul>
      ) : null}
    </aside>
  );
}
