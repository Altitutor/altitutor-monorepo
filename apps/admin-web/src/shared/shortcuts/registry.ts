/** App shortcuts share their bindings with buttons, menus and the command palette. */
export const shortcuts = {
  palette: { code: "KeyK", keys: ["Alt", "K"], title: "Command palette" },
  new: { code: "KeyN", keys: ["Alt", "N"], title: "New" },
  search: { code: "KeyF", keys: ["Alt", "F"], title: "Search" },
  right: { code: "BracketRight", keys: ["]"], title: "Toggle right panel" },
  left: { code: "BracketLeft", keys: ["["], title: "Toggle left panel" },
  close: { code: "KeyW", keys: ["Alt", "W"], title: "Close right tab" },
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
  if (!event.altKey && !event.metaKey && !event.ctrlKey) {
    if (event.code === "BracketLeft" || event.key === "[") return "left";
    if (event.code === "BracketRight" || event.key === "]") return "right";
    return;
  }
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
  return (["palette", "new", "search", "close"] as const).find((id) => shortcuts[id].code === code);
}
/** Sonner owns this scoped notification handler. */
export const toastHotkey = ["altKey", "shiftKey", "KeyT"];

export const pageShortcuts = [
  ["t", "/tasks", "Tasks"], ["i", "/issues", "Issues"],
  ["p", "/projects", "Projects"], ["d", "/documents", "Documents"],
  ["m", "/messages", "Messages"], ["e", "/email", "Mail"],
  ["h", "/dashboard", "Home"], ["s", "/students", "Students"],
  ["a", "/parents", "Parents"], ["f", "/staff", "Staff"],
  ["c", "/classes", "Classes"], ["n", "/sessions", "Sessions"],
  ["b", "/billing", "Invoices"], ["r", "/reports", "Reports"],
  ["u", "/subjects", "Subjects"], ["q", "/reconciliation", "Reconciliation"],
] as const;
