"use client";
import { createContext, useContext } from "react";

/** Opt in at the app shell; other portals keep their existing interaction model. */
export const KeyboardNavigationContext = createContext(false);
export const KeyboardNavigationProvider = KeyboardNavigationContext.Provider;
export const KeyboardHintsContext = createContext(false);
export const useKeyboardNavigation = () =>
  useContext(KeyboardNavigationContext);
export const useKeyboardHints = () => useContext(KeyboardHintsContext);

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
    !node.closest('[hidden],[inert],[aria-hidden="true"],[data-state="closed"][role="dialog"],[data-state="closed"][role="menu"]') &&
    node.getClientRects().length > 0
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
