import { isVisibleShortcutTarget } from "@altitutor/ui";
import { Calendar, CircleDot, Eye, Flag, Folder, FolderKanban, Gauge, Link2, User, Users, type LucideIcon } from "lucide-react";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";

type Property = {
  key: string;
  title: string;
  icon: LucideIcon;
  selector: string;
};

const status = { key: "status", title: "Set status", icon: CircleDot, selector: '[data-shortcut-field="s"]' };
const priority = { key: "priority", title: "Set priority", icon: Flag, selector: '[data-shortcut-field="p"]' };
const dueDate = { key: "due-date", title: "Set due date", icon: Calendar, selector: '[data-shortcut-field="d"]' };
const properties: Record<string, Property[]> = {
  task: [
    status,
    priority,
    { key: "assignee", title: "Set assignee", icon: User, selector: '[data-shortcut-field="a"]' },
    { key: "link", title: "Set link", icon: Link2, selector: '[data-work-item-property="link"]' },
    { key: "estimate", title: "Set estimate", icon: Gauge, selector: '[data-shortcut-field="e"]' },
    dueDate,
  ],
  issue: [status, priority, dueDate],
  project: [
    status,
    priority,
    { key: "lead", title: "Set lead", icon: User, selector: '[data-shortcut-field="a"]' },
    { key: "members", title: "Set members", icon: Users, selector: '[data-work-item-property="members"]' },
    { key: "start-date", title: "Set start date", icon: Calendar, selector: '[data-work-item-property="start-date"]' },
    { ...dueDate, key: "target-date", title: "Set target date" },
  ],
  document: [
    { key: "folder", title: "Set folder", icon: Folder, selector: '[data-work-item-property="folder"]' },
    { key: "project", title: "Set project", icon: FolderKanban, selector: '[data-work-item-property="project"]' },
    { key: "tutor-visibility", title: "Set tutor visibility", icon: Eye, selector: '[data-work-item-property="tutor-visibility"]' },
  ],
};

type PropertyAction = RecordMenuAction & { ready?: () => boolean };

export function workItemPropertyActions(
  type: string,
  run: (id: string, selector: string) => void,
  state?: { editable: boolean; ready: boolean },
): PropertyAction[] {
  return (properties[type === "note" ? "document" : type] ?? []).map(({ key, title, icon, selector }) => ({
    id: `set-${key}`,
    title,
    icon,
    action: () => run(`set-${key}`, selector),
    disabled: state && !state.editable,
    ready: state && (() => state.ready),
  }));
}

/** Reuse the current editor's picker, revealing the Properties drawer/section when needed. */
export function openWorkItemProperty(scope: HTMLElement, selector: string) {
  const openPicker = () => {
    if (!scope.isConnected) return true;
    const fields = [...scope.querySelectorAll<HTMLElement>(selector)].filter(isVisibleShortcutTarget);
    for (const field of fields) {
      const controls = [...field.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(isVisibleShortcutTarget);
      const picker = controls.find((control) => control.hasAttribute("aria-haspopup")) ?? controls[0];
      if (!picker) continue;
      picker.click();
      return true;
    }
    return false;
  };
  // Radix finishes dismissing the record menu before the next popover can take focus.
  requestAnimationFrame(() => {
    if (openPicker()) return;
    scope.querySelector<HTMLButtonElement>('[data-entity-properties-toggle][aria-expanded="false"]')?.click();
    requestAnimationFrame(() => {
      if (openPicker()) return;
      scope.querySelector<HTMLButtonElement>('[data-entity-sidebar-toggle="properties"][aria-expanded="false"]')?.click();
      requestAnimationFrame(openPicker);
    });
  });
}
