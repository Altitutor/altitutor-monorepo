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
  "hover:bg-muted/50 hover:shadow-md hover:!ring-black/[0.12]",
  "dark:hover:bg-muted/80 dark:hover:!ring-white/[0.22]",
);

/**
 * Subtle lift on hover + press scale on active.
 * Uses `.ucat-pressable-lift` in `globals.css` so hover translate + active scale compose.
 * Disabled when `prefers-reduced-motion: reduce` (rules live inside that media query).
 */
export const UCAT_PRESSABLE_LIFT_HOVER = "ucat-pressable-lift";

/** Press squash for controls that do not use lift (icon buttons use stronger `scale-95`). */
export const UCAT_PRESS_ACTIVE = "active:scale-[0.98]";

/**
 * Link / control chrome that should feel like a button press.
 * Use on `Link`, `Button asChild` targets, and other non-`<button>` hit targets
 * (global press CSS only covers real buttons).
 */
export const UCAT_CONTROL_PRESS = cn(UCAT_SURFACE_MOTION, UCAT_PRESS_ACTIVE);
/**
 * Selected / pressed chooser state — same neutral treatment as hover, held on.
 */
export const UCAT_CLICKABLE_CARD_SELECTED = cn(
  "!bg-muted/50 shadow-md !ring-black/[0.12]",
  "dark:!bg-muted/80 dark:!ring-white/[0.22]",
);

/** Quiet completion state for checklist and task rows. */
export const UCAT_COMPLETED_ITEM_SURFACE =
  "border-border/40 bg-muted/30 text-muted-foreground";

/** Secondary controls use the same neutral hover wash as app surfaces. */
export const UCAT_NEUTRAL_ACTION_HOVER =
  "hover:!bg-muted/70 hover:!text-foreground dark:hover:!bg-muted";

/** Focus ring for `Link` / `button` surfaces that use `UCAT_SURFACE_CARD`. */
export const UCAT_FOCUS_RING_INSET = cn(
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
);

/** Full-bleed dashboard grid tile (`Link` / `button` with icon + hover chevron). */
export function ucatDashboardNavTileClassName() {
  return ucatClickableCardClassName({ interactive: true });
}

/** Shared surface for settings-style nav cards and list rows. */
export function ucatClickableCardClassName(options?: {
  interactive?: boolean;
  /** Toggle / chooser selected state (practice wizard, option cards). */
  selected?: boolean;
  className?: string;
}) {
  const { interactive = true, selected = false, className } = options ?? {};
  return cn(
    "group relative flex h-full w-full flex-col items-start rounded-ucatShell p-6 text-left",
    UCAT_SURFACE_CARD,
    UCAT_SURFACE_MOTION,
    interactive && UCAT_PRESSABLE_LIFT_HOVER,
    interactive && UCAT_PRESSABLE_SURFACE_HOVER,
    interactive && UCAT_FOCUS_RING_INSET,
    selected && UCAT_CLICKABLE_CARD_SELECTED,
    className,
  );
}

/** Primary app cards */
export const UCAT_CARD_CHROME = cn(
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  "rounded-ucatShell",
);

/**
 * Elevated glass surface used for cards that overlap charts.
 * The stronger edge and directional shadow keep the card distinct from pale
 * graph backgrounds without losing the layered, translucent treatment.
 */
export const UCAT_FLOATING_GRAPH_CARD = cn(
  "rounded-2xl border border-border/90 bg-card/[0.97] text-card-foreground backdrop-blur-xl",
  "shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.07]",
  "dark:border-white/[0.12] dark:bg-card/[0.94] dark:shadow-[0_20px_55px_rgba(0,0,0,0.42)] dark:ring-white/[0.08]",
);

/**
 * Card header row with title + actions.
 * Keeps default CardHeader padding (including bottom) so content is not cramped.
 */
export const UCAT_CARD_HEADER_ROW =
  "flex flex-row items-center justify-between gap-3 space-y-0";

/** Extra top spacing on CardContent when the header needs more air above charts. */
export const UCAT_CARD_CONTENT_AFTER_HEADER = "pt-3";

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
 * Header outline surface — light: white fill; dark: muted fill (soft ring, no heavy border).
 */
export const UCAT_HEADER_BTN_OUTLINE = cn(
  UCAT_SURFACE_MOTION,
  "!rounded-[var(--ucat-radius-control)] !border-0 bg-white text-foreground shadow-sm",
  "ring-1 ring-black/[0.06] hover:bg-muted/70 dark:bg-muted/80 dark:ring-white/10 dark:hover:bg-muted",
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
 * Bottom-up hover wash (marketing `MagneticButton` motion language).
 * Applied by default on filled `@/components/ui/button` variants (`default`, `destructive`, `secondary`).
 * For native `<button>` / `<a>` CTAs, add this class with a solid `bg-*` fill.
 * Styles live in `globals.css` (`.ucat-btn-accent-fill-rise`).
 */
export const UCAT_ACCENT_FILL_RISE = "ucat-btn-accent-fill-rise" as const;

/**
 * Primary `AlertDialogAction` chrome (raw `@altitutor/ui` action skips the Button wrapper).
 */
export const UCAT_DIALOG_PRIMARY_ACTION = cn(
  UCAT_ACCENT_FILL_RISE,
  UCAT_CONTROL_PRESS,
);

/**
 * Primary CTA: light = navy (`--primary`) + light text; dark = light blue (`--accent`) + dark text (`--primary-foreground`).
 * Hover: marketing-style “fill up” wash (`UCAT_ACCENT_FILL_RISE`).
 */
export const UCAT_PRIMARY_ACTION_BUTTON = cn(
  UCAT_ACCENT_FILL_RISE,
  "relative z-0 inline-flex h-10 items-center justify-center rounded-ucatControl bg-primary px-4 text-sm font-medium text-primary-foreground dark:bg-accent dark:text-primary-foreground",
  "hover:bg-primary hover:shadow-md dark:hover:bg-accent",
  "motion-safe:hover:scale-[1.02]",
  UCAT_PRESS_ACTIVE,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100",
);

/** Smaller primary CTA (quota cards, inline upsells). */
export const UCAT_PRIMARY_ACTION_BUTTON_SM = cn(
  UCAT_PRIMARY_ACTION_BUTTON,
  "!h-9 px-3 text-xs",
);

/**
 * Full-width pill CTA used at the bottom of signup onboarding forms.
 * Keeps the marketing button proportions while using the active app theme.
 */
export const UCAT_SIGNUP_PRIMARY_ACTION = cn(
  UCAT_ACCENT_FILL_RISE,
  "inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-sm",
  "hover:bg-primary hover:shadow-md",
  "motion-safe:hover:scale-[1.02]",
  UCAT_PRESS_ACTIVE,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
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
