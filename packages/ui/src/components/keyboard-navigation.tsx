"use client";
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
  useSyncExternalStore,
  type RefObject,
} from "react";

/** Opt in at the app shell; other portals keep their existing interaction model. */
export const KeyboardNavigationContext = createContext(false);
export function KeyboardNavigationProvider({value,children}:{value:boolean;children:ReactNode}) {
  useEffect(() => value ? subscribeKeyboardScope(() => {}) : undefined, [value]);
  return <KeyboardNavigationContext.Provider value={value}>{children}</KeyboardNavigationContext.Provider>;
}
export const KeyboardHintsContext = createContext(false);
export const useKeyboardNavigation = () =>
  useContext(KeyboardNavigationContext);
const scopeListeners = new Set<() => void>();
let scopeObserver: MutationObserver | undefined;
const notifyScope = () => {
  scopeListeners.forEach((listener) => listener());
};
let pointerTarget: HTMLElement | null = null;
let focusedPane: HTMLElement | null = null;
const paneSelector = '[data-shortcut-pane],[data-accessory-tab],[data-admin-main]';
const trackPane = (event: Event) => {
  if (!(event.target instanceof Element)) return;
  const pane = event.target.closest<HTMLElement>(paneSelector);
  if (pane && focusedPane !== pane) {focusedPane = pane;notifyScope();}
};
const collectionRecord = "[data-keyboard-record]";
const otherRecords =
  "[data-shortcut-record],[data-conversation-row],[data-email-shortcut-target],[data-record-type][data-record-id]";

export function keyboardRecordFor(target: Element | null) {
  return target?.closest<HTMLElement>(collectionRecord) ??
    target?.closest<HTMLElement>(otherRecords) ?? null;
}

export function hoveredKeyboardRecord(root: Document) {
  return root.querySelector<HTMLElement>(`${collectionRecord}:hover`) ??
    root.querySelector<HTMLElement>(`:is(${otherRecords}):hover`);
}

const trackPointer = (event: Event) => {
  if (!(event.target instanceof Element)) return;
  setKeyboardPointerTarget(keyboardRecordFor(event.target));
};
const clearPointer = (event: Event) => {
  const related = (event as MouseEvent).relatedTarget;
  if (!(related instanceof Node) || !pointerTarget?.contains(related)) setKeyboardPointerTarget(null);
};
export function keyboardPointerTarget() {
  return pointerTarget?.isConnected && isVisibleShortcutTarget(pointerTarget) ? pointerTarget : null;
}
export function setKeyboardPointerTarget(node: HTMLElement | null) {
  if (pointerTarget === node) return;
  pointerTarget = node;
  notifyScope();
}
export function keyboardBulkOwner() {
  return [...document.querySelectorAll<HTMLElement>('[data-keyboard-collection][data-has-selection]')].find(isVisibleShortcutTarget) ?? null;
}
export function subscribeKeyboardScope(listener: () => void) {
  scopeListeners.add(listener);
  if (scopeListeners.size === 1) {
    document.addEventListener("focusin", notifyScope);
    document.addEventListener("focusin", trackPane);
    document.addEventListener("pointerdown", trackPane, true);
    document.addEventListener("pointerover", trackPointer);
    document.addEventListener("pointerout", clearPointer);
    document.addEventListener("focusout", notifyScope);
    scopeObserver = new MutationObserver(notifyScope);
    scopeObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "class",
        "style",
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
      document.removeEventListener("focusin", trackPane);
      document.removeEventListener("pointerdown", trackPane, true);
      document.removeEventListener("pointerover", trackPointer);
      document.removeEventListener("pointerout", clearPointer);
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
    subscribeKeyboardScope,
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
          [...owner.querySelectorAll<HTMLElement>("[data-shortcut-toolbar]")].find(isVisibleShortcutTarget) ===
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
    keyboardPointerTarget()?.closest<HTMLElement>(paneSelector) ??
    (focusedPane?.isConnected && isVisibleShortcutTarget(focusedPane) ? focusedPane : null) ??
    focus?.closest<HTMLElement>(paneSelector) ??
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
