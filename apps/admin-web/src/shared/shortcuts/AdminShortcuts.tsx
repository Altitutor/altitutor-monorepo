"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  useAccessoryPanel,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAdminShell } from "@/shared/contexts/AdminShellContext";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { useMobileMenu } from "@/shared/contexts/MobileMenuContext";
import { matchShortcut, panelShortcuts, shortcuts } from "./registry";
import { AltHintsContext } from "./context";
import { activeDialog, searchControl } from "./search";
import { SearchHint } from "./SearchHint";
import { NewDocumentDialog } from "./NewDocumentDialog";

export function AdminShortcuts({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState(false);
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
  useEffect(() => {
    const reset = () => setHeld(false);
    const keyup = (event: KeyboardEvent) => {
      if (!event.altKey) reset();
    };
    const keydown = (event: KeyboardEvent) => {
      setHeld(event.altKey);
      if (event.defaultPrevented) return;
      const id = matchShortcut(event);
      if (!id) return;
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
      event.preventDefault();
      palette.close();
      if (id === "left") {
        if (window.matchMedia("(max-width: 767px)").matches) mobile.toggle();
        else shell.toggleSidebar();
      } else if (id === "right") panel?.toggle();
      else if (panelShortcuts.some((kind) => kind === id))
        panel?.openTab({
          kind: id as (typeof panelShortcuts)[number],
          title: shortcuts[id].title,
        });
    };
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [panel, shell, palette, createNew, mobile]);
  return (
    <AltHintsContext.Provider value={held}>
      {children}
      <SearchHint activeKey={panel?.expanded ? panel.activeKey : null} />
      <NewDocumentDialog
        open={newDocument}
        onClose={() => setNewDocument(false)}
      />
    </AltHintsContext.Provider>
  );
}
