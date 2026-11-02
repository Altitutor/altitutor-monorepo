/** App shortcuts share their bindings with buttons, menus and the command palette. */
export const shortcuts = {
  palette: { code: "KeyK", keys: ["Alt", "K"], title: "Command palette" },
  new: { code: "KeyN", keys: ["Alt", "N"], title: "New" },
  search: { code: "KeyF", keys: ["Alt", "F"], title: "Search" },
  right: {
    code: "ArrowRight",
    keys: ["Alt", "→"],
    title: "Toggle right panel",
  },
  left: { code: "ArrowLeft", keys: ["Alt", "←"], title: "Toggle left panel" },
} as const;
export type ShortcutId = keyof typeof shortcuts;
export function matchShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "code"
    | "altKey"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "isComposing"
  >,
): ShortcutId | undefined {
  if (event.isComposing || event.shiftKey) return;
  // Option changes the character on macOS; physical codes normally survive.
  // Some browser bridges only provide the resulting character.
  const optionCodes: Record<string, string> = {
    "˚": "KeyK",
    "˜": "KeyN",
    ƒ: "KeyF",
  };
  const code =
    event.code ||
    optionCodes[event.key] ||
    (event.key.length === 1 ? `Key${event.key.toUpperCase()}` : event.key);
  if (!event.altKey && (event.metaKey || event.ctrlKey) && code === "KeyK")
    return "palette";
  if (
    !event.altKey ||
    event.metaKey ||
    event.ctrlKey ||
    event.key === "AltGraph"
  )
    return;
  return (Object.keys(shortcuts) as ShortcutId[]).find(
    (id) => shortcuts[id].code === code,
  );
}
/** Sonner owns this scoped notification handler. */
export const toastHotkey = ["altKey", "shiftKey", "KeyT"];
