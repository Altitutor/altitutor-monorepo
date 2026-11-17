"use client";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type RefObject,
} from "react";

/** Opt in at the app shell; other portals keep their existing interaction model. */
export const KeyboardNavigationContext = createContext(false);
export const KeyboardNavigationProvider = KeyboardNavigationContext.Provider;
export const KeyboardHintsContext = createContext(false);
export const useKeyboardNavigation = () =>
  useContext(KeyboardNavigationContext);
const scopeListeners = new Set<() => void>();
let scopeObserver: MutationObserver | undefined;
const notifyScope = () => {
  scopeListeners.forEach((listener) => listener());
};
function subscribeScope(listener: () => void) {
  scopeListeners.add(listener);
  if (scopeListeners.size === 1) {
    document.addEventListener("focusin", notifyScope);
    document.addEventListener("focusout", notifyScope);
    scopeObserver = new MutationObserver(notifyScope);
    scopeObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "inert",
        "aria-hidden",
        "data-state",
        "disabled",
      ],
    });
  }
  return () => {
    scopeListeners.delete(listener);
    if (!scopeListeners.size) {
      document.removeEventListener("focusin", notifyScope);
      document.removeEventListener("focusout", notifyScope);
      scopeObserver?.disconnect();
      scopeObserver = undefined;
    }
  };
}
export function useKeyboardHints(
  target?: RefObject<HTMLElement | null>,
  kind?: "views" | "field",
) {
  const hints = useContext(KeyboardHintsContext);
  const available = useSyncExternalStore(
    subscribeScope,
    () => {
      if (!target) return true;
      const root = target.current;
      if (
        !root ||
        !ownsKeyboard(root) ||
        isTypingTarget(document.activeElement)
      )
        return false;
      const pane = keyboardPane();
      if (kind === "views") {
        if (
          pane.matches('[role="dialog"],[role="alertdialog"],[role="menu"]') ||
          !pane.contains(root)
        )
          return false;
        const owner =
          document.activeElement?.closest("[data-keyboard-collection]") ?? pane;
        return (
          owner.querySelector("[data-shortcut-toolbar]") ===
          root.closest("[data-shortcut-toolbar]")
        );
      }
      if (kind === "field") {
        const key = root.getAttribute("data-shortcut-field");
        if (!key) return false;
        const first = [
          ...pane.querySelectorAll<HTMLButtonElement>(
            `[data-shortcut-field="${key}"] button`,
          ),
        ].find((node) => isVisibleShortcutTarget(node) && !node.disabled);
        return Boolean(first && root.contains(first));
      }
      return true;
    },
    () => false,
  );
  return hints && available;
}

export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"]',
      ),
    )
  );
}
export function isVisibleShortcutTarget(node: HTMLElement) {
  return (
    !node.closest(
      '[hidden],[inert],[aria-hidden="true"],[data-state="closed"][role="dialog"],[data-state="closed"][role="menu"]',
    ) && node.getClientRects().length > 0
  );
}
/** Keyboard focus chooses the pane; preserved/hidden editors never participate. */
export function keyboardPane() {
  const focus = document.activeElement;
  const dialog = [
    ...document.querySelectorAll<HTMLElement>(
      '[role="dialog"],[role="alertdialog"],[role="menu"]',
    ),
  ]
    .filter(isVisibleShortcutTarget)
    .at(-1);
  return (
    dialog ??
    focus?.closest<HTMLElement>("[data-accessory-tab],[data-admin-main]") ??
    document.querySelector<HTMLElement>("[data-admin-main]") ??
    document.body
  );
}
export function ownsKeyboard(node: HTMLElement) {
  const pane = keyboardPane();
  return (
    isVisibleShortcutTarget(node) &&
    (pane.contains(node) || node.contains(pane))
  );
}
