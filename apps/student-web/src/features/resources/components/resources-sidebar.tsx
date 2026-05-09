'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import { studentCardCn } from '@/shared/lib/student-visual';

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
    <li className="rounded-lg">
      <div className="flex items-center gap-1 py-0.5 pl-0.5 pr-1">
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

        <Link
          href={item.href}
          className={cn(
            'min-w-0 flex-1 rounded-md px-1.5 py-1 text-sm font-medium transition-colors duration-300',
            item.active ? 'bg-muted/90 text-foreground' : 'hover:bg-muted/80'
          )}
        >
          <span className="block truncate">{item.label}</span>
        </Link>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-4">
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

export function ResourcesSidebar({ title, items }: { title: string; items: ResourceSidebarItem[] }) {
  return (
    <aside className={cn(studentCardCn('sticky top-6 self-start'), 'w-full p-4 lg:w-72')}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <SidebarTreeItem key={item.key} item={item} />
        ))}
      </ul>
    </aside>
  );
}
