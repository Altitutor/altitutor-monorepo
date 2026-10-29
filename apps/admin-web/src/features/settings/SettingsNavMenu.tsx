'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { useAdminShell } from '@/shared/contexts/AdminShellContext';
import { cn, navLinkActiveStyles, navLinkInactiveStyles } from '@/shared/utils';
import {
  filterSettingsSections,
  settingsBackHref,
  settingsSections,
  type SettingsNavItem,
} from './settings-nav';

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarExpandablePanel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </div>
  );
}

function SettingsSectionHeading({
  title,
  expanded,
  locked,
}: {
  title: string;
  expanded: boolean;
  locked: boolean;
}) {
  const { toggleGroup } = useAdminShell();
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => {
        if (!locked) toggleGroup(title);
      }}
      className={cn(
        'mt-2 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground',
        navLinkInactiveStyles,
      )}
    >
      <span>{title}</span>
      <ChevronDown
        className={cn('h-3 w-3 transition-transform duration-200', !expanded && '-rotate-90')}
      />
    </button>
  );
}

function CollapsedTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SettingsBackLink({ collapsed }: { collapsed: boolean }) {
  const link = (
    <Link
      href={settingsBackHref}
      prefetch={false}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
        navLinkInactiveStyles,
        collapsed && 'justify-center px-0',
      )}
    >
      <ArrowLeft className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
      {collapsed ? (
        <span className="sr-only">Back to app</span>
      ) : (
        <span className="overflow-hidden whitespace-nowrap">Back to app</span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return <CollapsedTooltip label="Back to app">{link}</CollapsedTooltip>;
}

function SettingsPageLink({
  item,
  pathname,
  collapsed,
}: {
  item: SettingsNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const active = isItemActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
        active ? navLinkActiveStyles : navLinkInactiveStyles,
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
      {collapsed ? (
        <span className="sr-only">{item.title}</span>
      ) : (
        <span className="overflow-hidden whitespace-nowrap">{item.title}</span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return <CollapsedTooltip label={item.title}>{link}</CollapsedTooltip>;
}

export function SettingsNavMenu({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { collapsedGroups } = useAdminShell();
  const [query, setQuery] = useState('');
  const filtering = !collapsed && query.trim().length > 0;
  const sections = filterSettingsSections(settingsSections, filtering ? query : '');

  useEffect(() => {
    if (collapsed) setQuery('');
  }, [collapsed]);

  return (
    <div className="flex flex-col gap-1">
      <SettingsBackLink collapsed={collapsed} />
      {collapsed ? null : (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search settings"
          className="h-9"
        />
      )}
      {sections.map((section) => {
        const expanded = collapsed || filtering || !collapsedGroups.includes(section.title);
        const links = section.items.map((item) => (
          <SettingsPageLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ));

        return (
          <div key={section.title} className="flex flex-col gap-1">
            {collapsed ? <div className="my-2 h-px bg-border" /> : (
              <SettingsSectionHeading title={section.title} expanded={expanded} locked={filtering} />
            )}
            {collapsed ? (
              links
            ) : (
              <SidebarExpandablePanel expanded={expanded}>{links}</SidebarExpandablePanel>
            )}
          </div>
        );
      })}
      {!collapsed && sections.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">No matching settings</p>
      ) : null}
    </div>
  );
}
