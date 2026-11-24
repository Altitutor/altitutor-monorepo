"use client";

import { useSyncExternalStore } from 'react';
import { History } from 'lucide-react';
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
        {pages.map(({ key, href, title }) => (
          <DropdownMenuItem key={key} title={title} onSelect={() => requestPane('navigate', href)}>
            <span className="truncate">{title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
