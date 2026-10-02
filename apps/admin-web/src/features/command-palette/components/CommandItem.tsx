/**
 * Command Item Component
 * Renders a command item in the command palette
 */

import { ShortcutKeys } from "@/shared/shortcuts/ShortcutKeys";
import {
  useAccessoryPanel,
  accessoryFamily,
} from "@/shared/contexts/AccessoryPanelContext";
import { Badge } from "@altitutor/ui";
import {
  commandPaletteItemActiveStyles,
  commandPaletteItemInactiveStyles,
} from "@altitutor/ui";
import { cn } from "@/shared/utils";
import type { LucideIcon } from "lucide-react";
import { highlightText } from "../utils/highlighting";

interface CommandItemProps {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onMouseEnter: () => void;
}

export function CommandItem({
  id,
  title,
  description,
  icon: Icon,
  isSelected,
  searchQuery,
  onSelect,
  onMouseEnter,
}: CommandItemProps) {
  const panel = useAccessoryPanel();
  const tab = panel?.expanded
    ? panel.tabs.find((tab) => tab.key === panel.activeKey)
    : undefined;
  const newFamily =
    id === "add-task"
      ? "tasks"
      : id === "add-issue"
        ? "issues"
        : id === "add-project"
          ? "projects"
          : undefined;
  const hasNewShortcut =
    newFamily && tab && accessoryFamily(tab.kind) === newFamily;
  const baseClasses = cn(
    "w-full flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer text-left",
    isSelected
      ? commandPaletteItemActiveStyles
      : commandPaletteItemInactiveStyles,
  );

  return (
    <button
      key={`command-${id}`}
      type="button"
      className={baseClasses}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-left">
        <div className="font-medium">{highlightText(title, searchQuery)}</div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {hasNewShortcut && <ShortcutKeys id="new" always />}
      <Badge variant="outline" className="text-xs flex-shrink-0">
        Command
      </Badge>
    </button>
  );
}
