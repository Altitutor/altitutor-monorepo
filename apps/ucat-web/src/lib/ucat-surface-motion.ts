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

/** Hover wash + shadow + ring (dashboard tiles, list rows, pressable cards). */
export const UCAT_PRESSABLE_SURFACE_HOVER = cn(
  "hover:bg-muted/40 hover:shadow-md hover:!ring-black/[0.1] dark:hover:!ring-white/[0.12]",
);

/** Subtle lift on hover; disabled when `prefers-reduced-motion: reduce`. */
export const UCAT_PRESSABLE_LIFT_HOVER = "motion-safe:hover:-translate-y-0.5";

/** Focus ring for `Link` / `button` surfaces that use `UCAT_SURFACE_CARD`. */
export const UCAT_FOCUS_RING_INSET = cn(
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
);

/** Full-bleed dashboard grid tile (`Link` / `button` with icon + hover chevron). */
export function ucatDashboardNavTileClassName() {
  return cn(
    "group relative flex h-full w-full flex-col items-start rounded-ucatShell p-6 text-left",
    UCAT_SURFACE_CARD,
    UCAT_SURFACE_MOTION,
    UCAT_PRESSABLE_LIFT_HOVER,
    UCAT_PRESSABLE_SURFACE_HOVER,
    UCAT_FOCUS_RING_INSET,
  );
}

/** Primary app cards */
export const UCAT_CARD_CHROME = cn(
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "rounded-ucatShell",
);

/**
 * Table wrapper — matches tutor-web dashboard tables (`tutorTableShell`):
 * card surface, soft shadow, subtle ring (not a nested "tray" border).
 */
export const UCAT_TABLE_SHELL = cn(
  UCAT_SURFACE_MOTION,
  "overflow-hidden rounded-ucatShell border-0 bg-card text-card-foreground",
  "shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.06]",
  "dark:shadow-[0_8px_30px_rgb(0,0,0,0.28)] dark:ring-white/[0.08]",
);

/** Pass to `@altitutor/ui` `TableHeader` to drop the default header rule (matches tutor tables). */
export const UCAT_TABLE_HEADER_CLASSNAME = "[&_tr]:border-b-0";

/** Header row strip — muted wash, no strong divider. */
export const UCAT_TABLE_HEADER_ROW = cn(
  "border-0 bg-muted/45 hover:bg-muted/45 dark:hover:bg-muted/45",
);

/** Body rows — zebra via hover only (overrides default `TableRow` border-b). */
export const UCAT_TABLE_BODY_ROW = cn(
  "border-0 transition-colors duration-300 hover:bg-muted/40 dark:hover:bg-muted/30",
);

/** Hairline separator */
export const UCAT_DIVIDER_TOP =
  "border-t border-black/[0.045] dark:border-white/[0.06]";

/**
 * Header outline surface — matches student-web `studentBtnOutline` (muted fill + soft ring, no heavy border).
 */
export const UCAT_HEADER_BTN_OUTLINE = cn(
  UCAT_SURFACE_MOTION,
  "!rounded-[var(--ucat-radius-control)] !border-0 bg-muted/80 text-foreground shadow-sm",
  "ring-1 ring-black/[0.06] hover:bg-muted dark:ring-white/10",
);

/**
 * Header / toolbar icon control (menu, theme toggle, page back). Same 36px hit as student `studentBtnIconOutline`.
 * Use with `Button variant="outline" size="icon"`.
 */
export const UCAT_HEADER_ICON_BUTTON = cn(
  UCAT_HEADER_BTN_OUTLINE,
  "box-border !inline-flex !size-9 shrink-0 items-center justify-center gap-0",
  "active:scale-95",
  "[&>svg]:pointer-events-none [&>svg]:shrink-0",
);

/** Sticky app header bottom edge */
export const UCAT_APP_HEADER_RULE =
  "border-b border-black/[0.045] dark:border-white/[0.06]";

/**
 * Current page in `TablePagination` — matches sidebar **selected** nav treatment:
 * light: same fill as `--primary` (via `--sidebar`); dark: `sidebar-foreground/20` wash like active nav links.
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
  "group flex items-center gap-3 rounded-ucatControl p-3",
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_PRESSABLE_LIFT_HOVER,
);

/** Mocks / sets / generated-set list row link */
export const UCAT_LIST_ROW_LINK = cn(
  "group",
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "flex items-center gap-3 rounded-ucatShell p-4",
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_PRESSABLE_LIFT_HOVER,
);

/**
 * Bottom-up hover wash; pair with `bg-primary text-primary-foreground dark:bg-accent dark:text-primary-foreground`.
 * Styles live in `globals.css` (`.ucat-btn-accent-fill-rise`).
 */
export const UCAT_ACCENT_FILL_RISE = "ucat-btn-accent-fill-rise" as const;

/**
 * Primary CTA: light = navy (`--primary`) + light text; dark = light blue (`--accent`) + dark text (`--primary-foreground`).
 * Hover: marketing-style “fill up” wash (`UCAT_ACCENT_FILL_RISE`).
 */
export const UCAT_PRIMARY_ACTION_BUTTON = cn(
  UCAT_ACCENT_FILL_RISE,
  "inline-flex h-10 items-center justify-center rounded-ucatControl bg-primary px-4 text-sm font-medium text-primary-foreground dark:bg-accent dark:text-primary-foreground",
  "hover:shadow-md motion-safe:hover:scale-[1.02]",
  "active:scale-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100",
);

/** Card-style surfaces that lift slightly on hover */
export const UCAT_CARD_RAISED_HOVER = cn(
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_PRESSABLE_LIFT_HOVER,
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
