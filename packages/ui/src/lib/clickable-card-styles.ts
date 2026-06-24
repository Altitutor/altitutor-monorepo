import { cn } from './cn';

/** Hover lift + shadow for clickable cards (parent needs `group`). */
export const clickableCardHoverCn =
  'hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:ring-black/[0.1] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:hover:ring-white/[0.12]';

/** Same as hover, for cards with overlay links (focus-within). */
export const clickableCardFocusWithinCn =
  'focus-within:-translate-y-0.5 focus-within:bg-muted/40 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:ring-black/[0.1] dark:focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:focus-within:ring-white/[0.12]';

/** Combined hover + focus-within for interactive cards. */
export const clickableCardInteractiveCn = cn(
  clickableCardHoverCn,
  clickableCardFocusWithinCn,
);

/** Append extra classes to interactive card styles. */
export function clickableCardInteractiveWith(...parts: Array<string | undefined>) {
  return cn(clickableCardInteractiveCn, ...parts);
}

/** Focus ring for link-wrapped cards. */
export const clickableCardFocusRingCn =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35';
