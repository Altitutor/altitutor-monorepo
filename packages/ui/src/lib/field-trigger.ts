import { cn } from './cn';

/** Shared trigger styling for entity property sidebar fields (assignee, status, dates, etc.). */
export const fieldTriggerClassName = cn(
  'inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2',
  'text-sm font-normal text-foreground transition-colors',
  'hover:bg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

export const searchableSelectChevronClassName =
  'ml-2 h-4 w-4 shrink-0 text-muted-foreground opacity-50';
