import { cn } from './cn';

/** Hover treatment for clickable cards (parent needs `group`). */
export const clickableCardHoverCn =
  'hover:-translate-y-0.5 hover:bg-muted/50 dark:hover:bg-muted/80';

/** Same as hover, for cards with overlay links (focus-within). */
export const clickableCardFocusWithinCn =
  'focus-within:-translate-y-0.5 focus-within:bg-muted/50 dark:focus-within:bg-muted/80';

/** Subtle trailing affordance for clickable cards without changing border width. */
export const clickableCardRevealArrowCn =
  "after:pointer-events-none after:absolute after:right-3 after:top-3 after:text-muted-foreground after:opacity-0 after:transition-all after:duration-200 after:content-['>'] hover:after:translate-x-0.5 hover:after:opacity-100 hover:after:text-foreground focus-within:after:translate-x-0.5 focus-within:after:opacity-100 focus-within:after:text-foreground";

/** Combined hover + focus-within for interactive cards. */
export const clickableCardInteractiveCn = cn(
  clickableCardHoverCn,
  clickableCardFocusWithinCn,
  clickableCardRevealArrowCn,
);

/** Append extra classes to interactive card styles. */
export function clickableCardInteractiveWith(...parts: Array<string | undefined>) {
  return cn(clickableCardInteractiveCn, ...parts);
}

/** Focus ring for link-wrapped cards. */
export const clickableCardFocusRingCn =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35';
