'use client';

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ScrollArea,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';

export function EntitySidebarCard({
  value,
  title,
  children,
  contentClassName,
  flush = false,
}: {
  value: string;
  title: string;
  children: ReactNode;
  contentClassName?: string;
  flush?: boolean;
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
          <span className="text-sm font-semibold">{title}</span>
        </AccordionTrigger>
        <AccordionContent
          className={cn(
            flush
              ? 'border-t border-border/60 p-0 [&>div]:p-0'
              : 'space-y-1 border-t border-border/60 px-3 pb-4 pt-2',
            contentClassName,
          )}
        >
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}

export function EntitySidebarCards({
  defaultOpen,
  children,
  className,
}: {
  defaultOpen?: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <div className={cn('space-y-4 p-4', className)}>
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-4">
          {children}
        </Accordion>
      </div>
    </ScrollArea>
  );
}
