import { cn } from '@/shared/utils';

/** Default motion for interactive student UI; matches `globals.css` / Tailwind motion tokens. */
export const studentTransition =
  'transition-[color,background-color,border-color,box-shadow,transform,opacity,filter] duration-motion-subtle ease-motion-standard';

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

/** Sheet / dialog shell — borderless, soft shadow + ring (matches app cards). */
export const studentModalShell =
  'border-0 bg-card shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] dark:shadow-[0_12px_48px_rgb(0,0,0,0.45)] dark:ring-white/10';

/** Hairline separator inside modals (no heavy borders). */
export const studentModalHairline = 'h-px w-full bg-black/[0.07] dark:bg-white/10';

/** Compact list row inside a modal (people / meta blocks). */
export const studentModalInsetCard =
  'rounded-xl border-0 bg-muted/45 p-3 ring-1 ring-black/[0.06] transition-colors duration-300 dark:bg-muted/25 dark:ring-white/10';

/** Footer strip for wizard dialogs. */
export const studentModalFooter =
  'flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4 dark:bg-white/[0.04]';

/**
 * Use on `Button` with `variant="outline"` for header-aligned secondary actions (matches tutor-web shell).
 * (`border-0` drops the default outline border in favor of ring + soft fill.)
 */
export const studentBtnOutline = cn(
  studentTransition,
  'rounded-xl border-0 bg-muted/80 shadow-sm ring-1 ring-black/[0.06] hover:bg-muted dark:ring-white/10',
);

/** Primary buttons — consistent radius + shadow */
export const studentBtnPrimary = cn(studentTransition, 'rounded-xl shadow-sm');

/** Icon-only outline control (notifications, theme, compact toolbars) */
export const studentBtnIconOutline = cn(studentBtnOutline, 'size-9 shrink-0');
