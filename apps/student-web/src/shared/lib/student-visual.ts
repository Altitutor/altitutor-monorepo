import { cn } from '@/shared/utils';

/** Default motion for interactive student UI (aligned with landing feel). */
export const studentTransition = 'transition-all duration-300 ease-out';

/**
 * Solid card / panel: soft shadow and minimal ring instead of heavy borders.
 */
export const studentSurfaceCard =
  'rounded-2xl border-0 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.06] dark:shadow-[0_8px_30px_rgb(0,0,0,0.28)] dark:ring-white/[0.08]';

export function studentCardCn(...parts: Array<string | undefined>) {
  return cn(studentSurfaceCard, studentTransition, ...parts);
}

/** Wrapper around data tables */
export const studentTableShell = cn(studentSurfaceCard, 'overflow-hidden');

/** Table header strip — no strong divider line */
export const studentTableHeaderRow =
  'border-0 bg-muted/45 hover:bg-muted/45 dark:hover:bg-muted/45';

/** Body rows — zebra via hover only */
export const studentTableBodyRow = cn(
  'border-0 transition-colors duration-300 hover:bg-muted/40 dark:hover:bg-muted/30',
);

/** Tabs control — pill list like landing CTAs */
export const studentTabsList =
  'inline-flex h-11 items-center justify-center rounded-2xl bg-muted/90 p-1.5 text-muted-foreground ring-1 ring-black/[0.05] dark:bg-muted/50 dark:ring-white/10';

export const studentTabsTrigger =
  'rounded-xl px-4 py-2 transition-all duration-300 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';
