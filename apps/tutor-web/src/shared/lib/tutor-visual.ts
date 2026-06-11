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

/** Sheet / dialog shell — borderless, soft shadow + ring (matches app cards). */
export const tutorModalShell =
  'border-0 bg-card shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] dark:shadow-[0_12px_48px_rgb(0,0,0,0.45)] dark:ring-white/10';

/** Right-side sheet: override default `border-l`, soften corners on large screens. */
export const tutorSheetContentClass = cn(
  tutorModalShell,
  '!border-l-0 shadow-2xl sm:rounded-l-3xl',
);

/** Centered dialog content: override default border + `sm:rounded-lg`. */
export const tutorDialogContentClass = cn(
  tutorModalShell,
  'sm:rounded-2xl',
);

/** Sticky header / footer strips inside modals (replaces flat `border-b` bars). */
export const tutorDialogHeaderStrip =
  'border-0 bg-muted/30 ring-1 ring-black/[0.06] dark:bg-white/[0.04] dark:ring-white/10';

export const tutorDialogFooterStrip = tutorDialogHeaderStrip;

/** Hairline between sections inside sheets (optional). */
export const tutorModalHairline = 'h-px w-full bg-black/[0.07] dark:bg-white/10';

/**
 * Use on `Button` with `variant="outline"` for redesign-aligned secondary actions.
 * (Tailwind merges with button variant; `border-0` drops the default outline border.)
 */
export const tutorBtnOutline = cn(
  tutorTransition,
  'rounded-xl border-0 bg-muted/80 shadow-sm ring-1 ring-black/[0.06] hover:bg-muted dark:ring-white/10',
);

/** Primary buttons — consistent radius + shadow */
export const tutorBtnPrimary = cn(tutorTransition, 'rounded-xl shadow-sm');

/** Icon-only outline control (back, close, expand) */
export const tutorBtnIconOutline = cn(tutorBtnOutline, 'size-9 shrink-0');
