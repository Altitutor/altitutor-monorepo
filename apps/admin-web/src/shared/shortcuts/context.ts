import { createContext } from "react";
export type PaletteModifier = "⌘" | "Ctrl" | null;
export const PaletteModifierContext = createContext<PaletteModifier>(null);

export const AltHintsContext = createContext(false);

export const GoHintsContext = createContext(false);

export const ShortcutAvailabilityContext = createContext<Partial<
  Record<import("./registry").ShortcutId, boolean>
> | null>(null);
