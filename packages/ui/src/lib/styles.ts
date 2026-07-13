/** Shared motion for sidebar and nav list items */
export const navItemTransitionStyles =
  'transition-colors duration-300 ease-out';

/** Translucent hover fill for nav items */
export const navHoverStyles = 'hover:bg-muted/80 dark:hover:bg-white/[0.07]';

/** Selected nav item — slightly stronger than hover */
export const navActiveStyles =
  'bg-muted font-medium dark:bg-white/[0.11] hover:bg-muted dark:hover:bg-white/[0.11]';

/** Inactive nav link state (hover only) */
export const navLinkInactiveStyles = `${navItemTransitionStyles} ${navHoverStyles}`;

/** Active/selected nav link state */
export const navLinkActiveStyles = `${navItemTransitionStyles} ${navActiveStyles}`;

/** Active page number in pagination — matches selected nav item */
export const paginationPageActiveStyles = navLinkActiveStyles;

/** Inactive page number in pagination — matches nav hover treatment */
export const paginationPageInactiveStyles = navLinkInactiveStyles;

/** Selected row in command palette / entity pickers */
export const commandPaletteItemActiveStyles = navLinkActiveStyles;

/** Unselected row in command palette / entity pickers */
export const commandPaletteItemInactiveStyles = navLinkInactiveStyles;

/** Selected filter chip in command palette toolbars */
export const commandPaletteFilterActiveStyles = navActiveStyles;

/** Unselected filter chip in command palette toolbars */
export const commandPaletteFilterInactiveStyles = `${navItemTransitionStyles} ${navHoverStyles} text-muted-foreground`;

/**
 * Focus highlight for Select / listbox options (Radix uses focus for the
 * highlighted option). Matches selected nav fill.
 */
export const menuItemFocusStyles = `${navItemTransitionStyles} focus:bg-muted dark:focus:bg-white/[0.11]`;

/**
 * Command / combobox rows: translucent hover + aria-selected fill.
 * Prefer this over bg-accent for menu-like lists.
 */
export const menuItemInteractiveStyles = `${navItemTransitionStyles} ${navHoverStyles} aria-selected:bg-muted dark:aria-selected:bg-white/[0.11]`;
