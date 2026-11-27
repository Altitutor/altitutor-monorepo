"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useAccessoryPanel,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAdminShell } from "@/shared/contexts/AdminShellContext";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { useMobileMenu } from "@/shared/contexts/MobileMenuContext";
import {
  isTypingTarget,
  KeyboardNavigationProvider,
  KeyboardHintsContext,
} from "@altitutor/ui";
import { usePathname, useRouter } from "next/navigation";
import { ShortcutHelp } from "./ShortcutHelp";
import {
  forwardWorkspaceShortcut,
  requestPane,
  workspaceShortcutEvent,
  type WorkspaceShortcut,
} from "@/shared/components/pane-workspace/pane-routing";
import {
  hoveredKeyboardRecord,
  isVisibleShortcutTarget,
  keyboardBulkOwner,
  keyboardPane,
  keyboardPointerTarget,
  keyboardRecordFor,
  setKeyboardPointerTarget,
} from "@altitutor/ui";
import { matchShortcut, pageShortcuts } from "./registry";
import {
  AltHintsContext,
  GoHintsContext,
  PaletteModifierContext,
  type PaletteModifier,
  ShortcutAvailabilityContext,
} from "./context";
import { activeDialog, searchControl, searchTrigger, visibleControl } from "./search";
import { SearchHint } from "./SearchHint";
import { NewDocumentDialog } from "./NewDocumentDialog";

const workspaceFrame = "iframe[data-admin-pane-frame]";

function pointerDocument() {
  const workspace = window.frameElement?.matches(workspaceFrame) ? window.parent.document : document;
  return workspace.querySelector<HTMLIFrameElement>(`${workspaceFrame}:hover`)?.contentDocument ?? workspace;
}

function hoveredMenuRecord() {
  const hoveredDocument = pointerDocument();
  if (hoveredDocument === document) return keyboardPointerTarget();
  return hoveredKeyboardRecord(hoveredDocument);
}

function activateShortcutButton(button: HTMLButtonElement) {
  if (button.getAttribute("aria-haspopup") === "menu") {
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  } else {
    button.click();
  }
}

function openRecordContextMenu(record: HTMLElement) {
  const selector = "[data-record-type][data-record-id]";
  const target = record.matches(selector) ? record : record.querySelector<HTMLElement>(selector);
  const view = target?.ownerDocument.defaultView;
  return Boolean(target && view && !target.dispatchEvent(new view.MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
  })));
}

export function AdminShortcuts({ children, peerGoHintsActive = false, peerPaletteModifier = null }: {
  children: ReactNode;
  peerGoHintsActive?: boolean;
  peerPaletteModifier?: PaletteModifier;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [go, setGo] = useState(false);
  const goPending = useRef<{ openInNewPane: boolean } | null>(null);
  const goTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [help, setHelp] = useState(false);
  const [held, setHeld] = useState(false);
  const [paletteModifier, setPaletteModifier] = useState<PaletteModifier>(null);
  const [modified, setModified] = useState(false);
  const [typing, setTyping] = useState(false);
  const [dialogActive, setDialogActive] = useState(false);
  useEffect(() => {
    const update = () => setDialogActive(Boolean(activeDialog()));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "data-state"],
    });
    return () => observer.disconnect();
  }, []);
  const [newDocument, setNewDocument] = useState(false);
  const panel = useAccessoryPanel();
  const shell = useAdminShell();
  const palette = useCommandPalette();
  const actions = useQuickActions();
  const mobile = useMobileMenu();
  const tab = panel?.expanded
    ? panel.tabs.find((tab) => tab.key === panel.activeKey)
    : undefined;
  const family = tab ? accessoryFamily(tab.kind) : undefined;
  const createDocument = useCallback(() => setNewDocument(true), []);
  const createNew =
    family === "tasks"
      ? actions.openCreateTaskDialog
      : family === "issues"
        ? actions.openCreateIssueDialog
        : family === "projects"
          ? actions.openCreateProjectDialog
          : family === "documents"
            ? createDocument
            : null;
  useEffect(() => () => clearTimeout(goTimer.current), []);
  useEffect(() => {
    const cancelGo = () => {
      goPending.current = null;
      setGo(false);
      clearTimeout(goTimer.current);
    };
    const reset = () => {
      setHeld(false);
      setPaletteModifier(null);
      setModified(false);
      setTyping(false);
      cancelGo();
    };
    const updateModifiers = (event: KeyboardEvent) => {
      setPaletteModifier(!event.altKey && !event.shiftKey
        ? event.metaKey ? "⌘" : event.ctrlKey ? "Ctrl" : null
        : null);
      setHeld(
        event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey,
      );
      setModified(
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
      );
    };
    const focus = (event: FocusEvent) => {
      const editing = isTypingTarget(event.target);
      setTyping(editing);
      if (editing || activeDialog()) cancelGo();
    };
    const focusout = (event: FocusEvent) => setTyping(isTypingTarget(event.relatedTarget));
    const toggleLeftSidebar = () => {
      if (window.matchMedia("(max-width: 767px)").matches) mobile.toggle();
      else shell.toggleSidebar();
    };
    const receiveWorkspaceShortcut = (event: Event) => {
      const shortcut = (event as CustomEvent<WorkspaceShortcut>).detail;
      if (shortcut === "palette") palette.toggle();
      if (shortcut === "left") {
        palette.close();
        toggleLeftSidebar();
      }
    };
    const keyup = updateModifiers;
    const keydown = (event: KeyboardEvent) => {
      updateModifiers(event);
      if (event.defaultPrevented) return;
      const bare =
        !event.altKey && !event.metaKey && !event.ctrlKey && !event.isComposing;
      const typing = isTypingTarget(event.target);
      const key = event.key.toLowerCase();
      const currentDialog = activeDialog();
      if (typing || currentDialog) cancelGo();
      if (
        bare &&
        !goPending.current &&
        !typing &&
        !event.shiftKey &&
        !event.repeat &&
        ["s", "p", "a", "d", "e"].includes(key) && !keyboardBulkOwner() && !keyboardPointerTarget()?.closest("[data-keyboard-collection]")
      ) {
        const field = [
          ...keyboardPane().querySelectorAll<HTMLButtonElement>(
            `[data-shortcut-field="${key}"] button`,
          ),
        ].find(
          (node) => isVisibleShortcutTarget(node) && !node.matches(":disabled"),
        );
        if (field) {
          event.preventDefault();
          field.click();
          return;
        }
      }
      if (bare && !typing && !event.repeat && !goPending.current && !event.shiftKey &&
        (key === "m" || (key === "f" && !currentDialog))) {
        const pointer = keyboardPointerTarget();
        const pane = keyboardPane();
        const activePane = document.querySelector("[data-admin-active-pane='true']");
        const peerPane = activePane
          ?.querySelector<HTMLIFrameElement>(workspaceFrame)
          ?.contentDocument?.querySelector("[data-admin-main]");
        const scope = pointer ? pane : peerPane ?? pane;
        const selector = key === "m" ? "[data-shortcut-menu]" : "[data-shortcut-filter]";
        const record = key === "m"
          ? hoveredMenuRecord() ?? keyboardRecordFor(document.activeElement)
          : null;
        if (currentDialog && (
          pane.matches('[role="menu"]') ||
          (event.target instanceof Element && event.target.closest('[role="menu"]')) ||
          !record?.closest('[role="dialog"],[role="alertdialog"]')
        )) return;

        const menu = record
          ? visibleControl<HTMLButtonElement>(record, selector)
          : visibleControl<HTMLButtonElement>(scope, `[data-admin-page-header] ${selector}`)
            ?? visibleControl<HTMLButtonElement>(scope, selector);
        if (menu) {
          event.preventDefault();
          activateShortcutButton(menu);
          return;
        }
        if (key === "m" && record && openRecordContextMenu(record)) {
          event.preventDefault();
          return;
        }
      }
      if (bare && !typing && !currentDialog && !event.repeat) {
        if (goPending.current && key === "shift") return;
        if (goPending.current) {
          const openInNewPane = goPending.current.openInNewPane || event.shiftKey;
          cancelGo();
          event.preventDefault();
          event.stopPropagation();
          const page = pageShortcuts.find(([letter]) => letter === key);
          if (page) {
            if (!requestPane(openInNewPane ? "open" : "navigate", page[1])) router.push(page[1]);
            mobile.close?.();
          }
          return;
        }
        if (key === "escape" && !event.shiftKey && requestPane("back")) {
          event.preventDefault();
          return;
        }
        if (key === "g") {
          event.preventDefault();
          event.stopPropagation();
          goPending.current = { openInNewPane: event.shiftKey };
          setGo(true);
          goTimer.current = setTimeout(cancelGo, 1500);
          return;
        }
        if (event.key === "?") {
          event.preventDefault();
          setHelp(true);
          return;
        }
        if (["j", "k", "enter"].includes(key) && !event.shiftKey) {
          const pane = keyboardPane();
          if (!document.activeElement?.closest("[data-keyboard-collection]")) {
            const rows = [
              ...pane.querySelectorAll<HTMLElement>(
                "[data-shortcut-list-item]",
              ),
            ].filter(isVisibleShortcutTarget);
            const current = document.activeElement?.closest<HTMLElement>(
              "[data-shortcut-list-item]",
            );
            const index = current ? rows.indexOf(current) : -1;
            if (key === "enter" && current && event.target === current) {
              event.preventDefault();
              event.stopPropagation();
              current.click();
              return;
            }
            if (key !== "enter" && rows.length) {
              const next =
                rows[
                  Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      index < 0
                        ? key === "j"
                          ? 0
                          : rows.length - 1
                        : index + (key === "j" ? 1 : -1),
                    ),
                  )
                ];
              event.preventDefault();
              event.stopPropagation();
              setKeyboardPointerTarget(null);
              next.focus();
              next.scrollIntoView?.({ block: "nearest" });
              return;
            }
          }
        }
        if (key === "c" && !event.shiftKey) {
          const pane = keyboardPane();
          const main = !pane.closest("[data-accessory-tab]");
          const create = main
            ? {
                tasks: actions.openCreateTaskDialog,
                issues: actions.openCreateIssueDialog,
                projects: actions.openCreateProjectDialog,
                documents: createDocument,
              }[pathname.split("/")[1]]
            : createNew;
          const button =
            visibleControl<HTMLButtonElement>(pointerDocument(), "[data-shortcut-create]:hover")
            ?? [...pane.querySelectorAll<HTMLButtonElement>("[data-shortcut-create]")].find(isVisibleShortcutTarget);
          if (button && !button.disabled) {
            event.preventDefault();
            activateShortcutButton(button);
          } else if (!button && create) {
            event.preventDefault();
            create();
          }
          return;
        }
      }
      const id = matchShortcut(event);
      if (!id) return;
      if ((id === "left" || id === "right") && isTypingTarget(event.target))
        return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (id === "palette") {
        event.preventDefault();
        if (!forwardWorkspaceShortcut("palette")) palette.toggle();
        return;
      }
      // Dialogs own keyboard interaction except focusing their own search field.
      const closesMobileSidebar = id === "left" && mobile.isOpen && keyboardPane().id === "admin-mobile-sidebar";
      if (currentDialog && !palette.isOpen && id !== "search" && !closesMobileSidebar) return;
      if (id === "search") {
        const input = searchControl(panel?.expanded ? panel.activeKey : null);
        if (input) {
          event.preventDefault();
          input.focus();
          input.select();
        } else {
          const trigger = searchTrigger(
            panel?.expanded ? panel.activeKey : null,
          );
          if (trigger) {
            event.preventDefault();
            trigger.click();
          }
        }
        return;
      }
      if (id === "new") {
        if (createNew) {
          event.preventDefault();
          palette.close();
          createNew();
        }
        return;
      }
      if (id === "close") {
        if (requestPane("close")) {
          event.preventDefault();
          return;
        }
        if (panel?.expanded) {
          const close = document.querySelector<HTMLButtonElement>(
            `[data-close-accessory-tab="${CSS.escape(panel.activeKey ?? "")}"]`,
          );
          if (close) {
            event.preventDefault();
            close.click();
          }
        }
        return;
      }
      event.preventDefault();
      palette.close();
      if (id === "left") {
        if (!forwardWorkspaceShortcut("left")) toggleLeftSidebar();
      } else if (id === "right") panel?.toggle();
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focusout);
    window.addEventListener(workspaceShortcutEvent, receiveWorkspaceShortcut);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focusout);
      window.removeEventListener(workspaceShortcutEvent, receiveWorkspaceShortcut);
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [
    panel,
    shell,
    palette,
    createNew,
    mobile,
    router,
    pathname,
    actions,
    createDocument,
  ]);
  return (
    <KeyboardNavigationProvider value={true}>
      <KeyboardHintsContext.Provider value={!modified && !go && !typing}>
        <ShortcutAvailabilityContext.Provider
          value={{
            left: !modified && !go && !typing && (!dialogActive || Boolean(mobile.isOpen && typeof document !== "undefined" && keyboardPane().id === "admin-mobile-sidebar")),
            right: !modified && !go && !typing && !dialogActive,
            palette: true,
            search:
              typeof document !== "undefined" &&
              Boolean(
                searchControl(panel?.expanded ? panel.activeKey : null) ||
                  searchTrigger(panel?.expanded ? panel.activeKey : null),
              ),
            new: Boolean(createNew) && (!dialogActive || palette.isOpen),
            close: Boolean(panel?.expanded) && !dialogActive,
          }}
        >
          <GoHintsContext.Provider
            value={(go || peerGoHintsActive) && !typing && !dialogActive}
          >
            <PaletteModifierContext.Provider value={paletteModifier ?? peerPaletteModifier}>
            <AltHintsContext.Provider value={held}>
              {children}
              <ShortcutHelp open={help} onOpenChange={setHelp} />
              <SearchHint
                activeKey={panel?.expanded ? panel.activeKey : null}
              />
              <NewDocumentDialog
                open={newDocument}
                onClose={() => setNewDocument(false)}
              />
            </AltHintsContext.Provider>
            </PaletteModifierContext.Provider>
          </GoHintsContext.Provider>
        </ShortcutAvailabilityContext.Provider>
      </KeyboardHintsContext.Provider>
    </KeyboardNavigationProvider>
  );
}
