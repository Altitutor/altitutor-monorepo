/**
 * Shared marketing / landing palette (student-web v2, ucat-web marketing).
 * Keep Tailwind `marketing.*` theme extensions in apps in sync with these hex values.
 */
export const MARKETING_TOKENS = {
  colors: {
    /** Brand dark blue */
    primary: "#0a2941",
    /** Brand light blue */
    accent: "#92b9c6",
    /** Cream page background */
    background: "#F2F0E9",
    /** Charcoal for body text on light surfaces */
    dark: "#1A1A1A",
  },
  typography: {
    headingSans: "font-['Plus_Jakarta_Sans',sans-serif]",
    secondarySans: "font-['Outfit',sans-serif]",
    dramaSerif: "font-['Cormorant_Garamond',serif]",
    dataMono: "font-['IBM_Plex_Mono',monospace]",
  },
} as const;

/** Alias for legacy imports (`TOKENS` in landing components). */
export const TOKENS = MARKETING_TOKENS;
