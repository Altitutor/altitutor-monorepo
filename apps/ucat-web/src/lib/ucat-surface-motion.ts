/**
 * Shared motion / surface tokens for ucat-web.
 * Radii: `rounded-ucatShell` (cards, trays) vs `rounded-ucatControl` (buttons, icon hits).
 */

import { cn } from "@/lib/utils";

export const UCAT_INTERACTION_EASE =
  "ease-[cubic-bezier(0.32,0.72,0,1)]" as const;

/** Default motion for surfaces; matches `globals.css` / Tailwind motion tokens. */
export const UCAT_SURFACE_MOTION = cn(
  "transition-[color,background-color,box-shadow,transform,opacity,ring-color] duration-motion-subtle ease-motion-standard",
);

/**
 * Card / panel: soft shadow + very light ring.
 * `!border-0` overrides `@altitutor/ui` Card default border (`cn` here is clsx-only).
 */
export const UCAT_SURFACE_CARD = cn(
  "!border-0 bg-card text-card-foreground shadow-sm",
  /* Explicit neutrals so ring color never picks up theme `ring` / accent */
  "!ring-1 !ring-[hsl(0_0%_0%/0.055)] dark:!ring-[hsl(0_0%_100%/0.065)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.18)]",
);

/** Primary app cards */
export const UCAT_CARD_CHROME = cn(
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "rounded-ucatShell",
);

/**
 * Table “tray” inside cards: framed panel so edges read clearly vs `bg-card`.
 * Light: solid muted tray + white row stripes. Dark: canvas-dark tray + slightly lighter rows.
 */
export const UCAT_TABLE_SHELL = cn(
  UCAT_SURFACE_MOTION,
  "overflow-hidden rounded-ucatShell",
  "border border-border bg-muted shadow-sm",
  "dark:border-border dark:bg-background dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
);

/** Tinted header strip + baseline under header. */
export const UCAT_TABLE_HEADER_ROW = cn(
  "border-b border-border bg-primary/[0.08] text-muted-foreground",
  "dark:bg-primary/[0.14] dark:text-muted-foreground",
);

/** Body rows: card fill on tray + light row dividers between rows. */
export const UCAT_TABLE_BODY_ROW = cn(
  "border-b border-border/60 bg-card transition-colors duration-200 ease-out last:border-b-0",
  "hover:bg-muted/35 dark:hover:bg-white/[0.05]",
);

/** Hairline separator */
export const UCAT_DIVIDER_TOP =
  "border-t border-black/[0.045] dark:border-white/[0.06]";

/**
 * Header / toolbar icon control (back `Link`, menu `button`, theme toggle, floating `Button` + icon).
 * Includes `hover:bg-muted` + `active:scale-95` so all hits match.
 * Not composed from `UCAT_SURFACE_CARD`: fixed `!size-11` + `!p-2.5` must not fight `Card`-style classes,
 * and `Button size="icon"` needs `!` sizing/`!` radius to win under clsx-only merges.
 */
export const UCAT_HEADER_ICON_BUTTON = cn(
  UCAT_SURFACE_MOTION,
  "box-border !inline-flex !size-11 shrink-0 items-center justify-center gap-0 !p-2.5",
  "!rounded-[var(--ucat-radius-control)] !border-0 bg-card text-foreground shadow-sm",
  "!ring-1 !ring-[hsl(0_0%_0%/0.055)] !ring-offset-0 dark:!ring-[hsl(0_0%_100%/0.065)]",
  "hover:bg-muted active:scale-95",
  "[&>svg]:pointer-events-none [&>svg]:shrink-0",
);

/** Sticky app header bottom edge */
export const UCAT_APP_HEADER_RULE =
  "border-b border-black/[0.045] dark:border-white/[0.06]";

/**
 * Current page in `TablePagination` — matches sidebar **selected** nav treatment:
 * light: solid `sidebar` on white cards; dark: `sidebar-foreground/20` wash like active nav links.
 */
export const UCAT_PAGINATION_ACTIVE_PAGE_BUTTON = cn(
  "border-transparent shadow-sm font-medium text-sidebar-foreground",
  "bg-sidebar hover:bg-sidebar/88",
  "dark:bg-sidebar-foreground/20 dark:hover:bg-sidebar-foreground/28",
);

/** Session detail / smaller list tiles */
export const UCAT_COMPACT_LIST_ROW = cn(
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "flex items-center gap-3 rounded-ucatControl p-3",
  "hover:bg-muted/50 hover:shadow-md hover:!ring-[hsl(0_0%_0%/0.08)] dark:hover:!ring-[hsl(0_0%_100%/0.09)]",
);

/** Mocks / sets / generated-set list row link */
export const UCAT_LIST_ROW_LINK = cn(
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "flex items-center gap-3 rounded-ucatShell p-4",
  "hover:bg-muted/50 hover:shadow-md hover:!ring-[hsl(0_0%_0%/0.08)] dark:hover:!ring-[hsl(0_0%_100%/0.09)]",
);

/** Primary sidebar-style CTA (practice start, generate set) */
export const UCAT_PRIMARY_ACTION_BUTTON = [
  "inline-flex h-10 items-center justify-center rounded-ucatControl bg-sidebar px-4 text-sm font-medium text-sidebar-foreground",
  "transition-[transform,box-shadow,filter] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:shadow-md hover:brightness-105 active:scale-[0.98]",
  "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100",
].join(" ");

/** Card-style surfaces that lift slightly on hover */
export const UCAT_CARD_RAISED_HOVER = cn(
  "transition-[box-shadow,background-color,ring-color] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:bg-muted/40 hover:shadow-md hover:!ring-[hsl(0_0%_0%/0.08)] dark:hover:!ring-[hsl(0_0%_100%/0.09)]",
);

/** Inner pill in filter toolbars */
export const UCAT_FILTER_PILL_INNER = [
  "rounded-ucatControl px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

export const UCAT_FILTER_PILL_INNER_INLINE = [
  "inline-flex items-center gap-1 rounded-ucatControl px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

export const UCAT_SEGMENTED_TAB = [
  "inline-flex items-center gap-1.5 rounded-ucatControl px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

/** Native `<table>` header row (same tint as shadcn `Table` header) */
export const UCAT_NATIVE_TABLE_HEADER_ROW = UCAT_TABLE_HEADER_ROW;

/** Native `<table>` body row */
export const UCAT_NATIVE_TABLE_BODY_ROW = UCAT_TABLE_BODY_ROW;
