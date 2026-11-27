"use client";

import { useSyncExternalStore } from 'react';
import { ChevronRight, History } from 'lucide-react';
import { recordEntities } from '@/features/command-palette/model';
import { navItems } from '@/shared/constants/adminNavigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@altitutor/ui';
import { requestPane } from '@/shared/components/pane-workspace/pane-routing';
import { parseRecentPages, readRecentPages, subscribeToRecentPages } from './history';

const recordSections = {
  students: recordEntities.student,
  parents: recordEntities.parent,
  staff: recordEntities.staff,
  subjects: recordEntities.subject,
  topics: recordEntities.topic,
  classes: recordEntities.class,
  sessions: recordEntities.session,
  tasks: recordEntities.task,
  projects: recordEntities.project,
  issues: recordEntities.issue,
  documents: recordEntities.note,
  notes: recordEntities.note,
  email: recordEntities.email,
  messages: recordEntities.message,
  invoices: recordEntities.invoice,
  "admin-shifts": recordEntities.adminShift,
};

function pageSection(href: string) {
  const segment = href.split(/[/?#]/)[1] as keyof typeof recordSections;
  return recordSections[segment] ?? navItems.flatMap((item) =>
    item.type === 'heading' ? [] : [{ label: item.title, icon: item.icon, href: item.href }],
  ).find((item) => item.href === `/${segment}`);
}

export function RecentlyViewedMenu({ staffId }: { staffId: string }) {
  const snapshot = useSyncExternalStore(subscribeToRecentPages, () => readRecentPages(staffId), () => '');
  const pages = parseRecentPages(snapshot);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Recently viewed">
              <History className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Recently viewed</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <DropdownMenuLabel>Recently viewed</DropdownMenuLabel>
        {pages.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No recent pages</p>}
        {pages.map(({ key, href, title }) => {
          const section = pageSection(href);
          const Icon = section?.icon ?? History;
          return (
            <DropdownMenuItem key={key} title={title} onSelect={() => requestPane('navigate', href)}>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {section && section.label !== title && (
                <>
                  <span className="shrink-0 text-muted-foreground">{section.label}</span>
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                </>
              )}
              <span className="truncate font-medium">{title}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
