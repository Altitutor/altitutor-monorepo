/**
 * Shared motion / transition tokens for ucat-web interactive surfaces.
 * Keeps easing and durations consistent with layout shell and dashboard.
 */

export const UCAT_INTERACTION_EASE =
  "ease-[cubic-bezier(0.32,0.72,0,1)]" as const;

/** Session detail / smaller list tiles */
export const UCAT_COMPACT_LIST_ROW = [
  "flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm",
  "transition-[box-shadow,background-color,border-color] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:border-border hover:bg-muted hover:shadow-md",
].join(" ");

/** Mocks / sets / generated-set list row link */
export const UCAT_LIST_ROW_LINK = [
  "flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm",
  "transition-[box-shadow,background-color,border-color] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:border-border hover:bg-muted hover:shadow-md",
].join(" ");

/** Primary sidebar-style CTA (practice start, generate set) */
export const UCAT_PRIMARY_ACTION_BUTTON = [
  "inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground",
  "transition-[transform,box-shadow,filter] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:shadow-md hover:brightness-105 active:scale-[0.98]",
  "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100",
].join(" ");

/** Card-style surfaces that lift slightly on hover */
export const UCAT_CARD_RAISED_HOVER = [
  "transition-[box-shadow,background-color,border-color,transform] duration-200",
  UCAT_INTERACTION_EASE,
  "hover:border-border/80 hover:bg-muted/50 hover:shadow-md",
].join(" ");

/** Inner pill in filter toolbars (time mode, performance, set/unlimited) */
export const UCAT_FILTER_PILL_INNER = [
  "rounded-md px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

/** Time mode / performance row — gap-1 + optional tooltip icon */
export const UCAT_FILTER_PILL_INNER_INLINE = [
  "inline-flex items-center gap-1 rounded-md px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

/** Progress segmented control tabs */
export const UCAT_SEGMENTED_TAB = [
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
  "transition-[color,background-color,box-shadow] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");
