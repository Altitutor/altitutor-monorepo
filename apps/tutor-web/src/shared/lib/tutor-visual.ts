import { cn } from '@/shared/utils';

/** Default motion for interactive tutor UI (aligned with student app). */
export const tutorTransition = 'transition-all duration-300 ease-out';

/**
 * Solid card / panel: soft shadow and minimal ring instead of heavy borders.
 */
export const tutorSurfaceCard =
  'rounded-2xl border-0 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.06] dark:shadow-[0_8px_30px_rgb(0,0,0,0.28)] dark:ring-white/[0.08]';

export function tutorCardCn(...parts: Array<string | undefined>) {
  return cn(tutorSurfaceCard, tutorTransition, ...parts);
}

/** Wrapper around data tables */
export const tutorTableShell = cn(tutorSurfaceCard, 'overflow-hidden');

/** Table header strip — no strong divider line */
export const tutorTableHeaderRow =
  'border-0 bg-muted/45 hover:bg-muted/45 dark:hover:bg-muted/45';

/** Body rows — zebra via hover only */
export const tutorTableBodyRow = cn(
  'border-0 transition-colors duration-300 hover:bg-muted/40 dark:hover:bg-muted/30',
);

/** Spread onto `@altitutor/ui` `DataTable` for student-matched table chrome. */
export const tutorDataTableProps = {
  tableContainerClassName: tutorTableShell,
  tableHeaderClassName: '[&_tr]:border-b-0',
  headerRowClassName: tutorTableHeaderRow,
  bodyRowClassName: tutorTableBodyRow,
} as const;

/** Tabs control — pill list like student app */
export const tutorTabsList =
  'inline-flex h-11 items-center justify-center rounded-2xl bg-muted/90 p-1.5 text-muted-foreground dark:bg-background dark:ring-white/10';

export const tutorTabsTrigger =
  'rounded-xl px-4 py-2 transition-all duration-300 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';

/** Sheet / dialog shell — borderless, soft shadow + ring (matches app cards). */
export const tutorModalShell =
  'border-0 bg-card shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] dark:shadow-[0_12px_48px_rgb(0,0,0,0.45)] dark:ring-white/10';
