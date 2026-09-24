'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Folder } from 'lucide-react';
import { cn, navLinkActiveStyles, navLinkInactiveStyles } from '@/shared/utils';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

export type ResourceSidebarItem = {
  key: string;
  label: string;
  /** Omit to render as a non-interactive section header */
  href?: string;
  active?: boolean;
  children?: ResourceSidebarItem[];
  /** Documentation tree: folder rows expand on click; document rows navigate on click. */
  kind?: 'folder' | 'document';
};

function hasActiveDescendant(item: ResourceSidebarItem): boolean {
  return Boolean(item.children?.some((child) => child.active || hasActiveDescendant(child)));
}

function SidebarTreeItem({
  item,
  depth = 0,
  onNavigate,
}: {
  item: ResourceSidebarItem;
  depth?: number;
  onNavigate?: (href: string) => void;
}) {
  const hasChildren = Boolean(item.children?.length);
  const activeDescendant = hasActiveDescendant(item);
  const [expanded, setExpanded] = useState(item.active || activeDescendant || depth === 0);
  const isDocumentationFolder = item.kind === 'folder';
  const isDocumentationDocument = item.kind === 'document';

  useEffect(() => {
    if (item.active || activeDescendant) {
      setExpanded(true);
    }
  }, [activeDescendant, item.active]);

  const handleDocumentNavigate = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || !item.href) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigate(item.href);
  };

  return (
    <li className="rounded-lg">
      {isDocumentationFolder ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium',
            navLinkInactiveStyles,
          )}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
              expanded && 'rotate-90',
            )}
          />
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={item.label}>
            {item.label}
          </span>
        </button>
      ) : isDocumentationDocument && item.href ? (
        <Link
          href={item.href}
          onClick={handleDocumentNavigate}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium',
            item.active ? navLinkActiveStyles : navLinkInactiveStyles,
          )}
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={item.label}>
            {item.label}
          </span>
        </Link>
      ) : (
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
              onClick={handleDocumentNavigate}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium',
                item.active ? navLinkActiveStyles : navLinkInactiveStyles,
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
      )}

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
                  <SidebarTreeItem key={child.key} item={child} depth={depth + 1} onNavigate={onNavigate} />
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
  onNavigate,
}: {
  title: string;
  items: ResourceSidebarItem[];
  className?: string;
  onNavigate?: (href: string) => void;
}) {
  return (
    <aside className={cn(tutorCardCn(), 'w-full py-4 pl-2 pr-3 lg:w-72', className)}>
      <h3 className="mb-3 px-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <SidebarTreeItem key={item.key} item={item} onNavigate={onNavigate} />
        ))}
      </ul>
    </aside>
  );
}
