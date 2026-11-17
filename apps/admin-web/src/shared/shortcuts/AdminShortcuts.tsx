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
import { keyboardPane, isVisibleShortcutTarget } from "@altitutor/ui";
import { matchShortcut, pageShortcuts } from "./registry";
import {
  AltHintsContext,
  GoHintsContext,
  ShortcutAvailabilityContext,
} from "./context";
import { activeDialog, searchControl, searchTrigger } from "./search";
import { SearchHint } from "./SearchHint";
import { NewDocumentDialog } from "./NewDocumentDialog";

export function AdminShortcuts({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [go, setGo] = useState(false);
  const goPending = useRef(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [help, setHelp] = useState(false);
  const [held, setHeld] = useState(false);
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
      goPending.current = false;
      setGo(false);
      clearTimeout(goTimer.current);
    };
    const reset = () => {
      setHeld(false);
      setModified(false);
      setTyping(false);
      cancelGo();
    };
    const updateModifiers = (event: KeyboardEvent) => {
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
    const keyup = updateModifiers;
    const keydown = (event: KeyboardEvent) => {
      updateModifiers(event);
      if (event.defaultPrevented) return;
      const bare =
        !event.altKey && !event.metaKey && !event.ctrlKey && !event.isComposing;
      const typing = isTypingTarget(event.target);
      const key = event.key.toLowerCase();
      if (typing || activeDialog()) cancelGo();
      if (
        bare &&
        !goPending.current &&
        !typing &&
        !event.shiftKey &&
        !event.repeat &&
        ["s", "p", "a"].includes(key)
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
      if (bare && !typing && !activeDialog() && !event.repeat) {
        if (goPending.current) {
          cancelGo();
          event.preventDefault();
          event.stopPropagation();
          const page = pageShortcuts.find(([letter]) => letter === key);
          if (page) {
            router.push(page[1]);
            mobile.close?.();
          }
          return;
        }
        if (key === "g" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          goPending.current = true;
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
          const button = [
            ...pane.querySelectorAll<HTMLButtonElement>(
              "[data-shortcut-create]",
            ),
          ].find(isVisibleShortcutTarget);
          if (create || button) {
            event.preventDefault();
            if (button) button.click();
            else create?.();
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
        palette.toggle();
        return;
      }
      const dialog = activeDialog();
      // Dialogs own keyboard interaction except focusing their own search field.
      if (dialog && !palette.isOpen && id !== "search") return;
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
        if (window.matchMedia("(max-width: 767px)").matches) mobile.toggle();
        else shell.toggleSidebar();
      } else if (id === "right") panel?.toggle();
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focusout);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focusout);
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
            left: !modified && !go && !typing && !dialogActive,
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
            value={go && !modified && !typing && !dialogActive}
          >
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
          </GoHintsContext.Provider>
        </ShortcutAvailabilityContext.Provider>
      </KeyboardHintsContext.Provider>
    </KeyboardNavigationProvider>
  );
}
