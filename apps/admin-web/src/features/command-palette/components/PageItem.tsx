/**
 * Page Item Component
 * Renders a page item in the command palette
 */

import { ShortcutKeys } from "@/shared/shortcuts/ShortcutKeys";
import { panelShortcut } from "@/shared/shortcuts/registry";
import { Badge } from "@altitutor/ui";
import {
  commandPaletteItemActiveStyles,
  commandPaletteItemInactiveStyles,
} from "@altitutor/ui";
import { cn } from "@/shared/utils";
import type { LucideIcon } from "lucide-react";
import { highlightText } from "../utils/highlighting";

interface PageItemProps {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  isSelected: boolean;
  searchQuery: string;
  onSelect: () => void;
  onMouseEnter: () => void;
}

export function PageItem({
  id,
  title,
  href,
  icon: Icon,
  isSelected,
  searchQuery,
  onSelect,
  onMouseEnter,
}: PageItemProps) {
  const baseClasses = cn(
    "w-full flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer text-left",
    isSelected
      ? commandPaletteItemActiveStyles
      : commandPaletteItemInactiveStyles,
  );

  return (
    <button
      key={`page-${id}`}
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
      </div>
      {panelShortcut(href.slice(1)) && (
        <ShortcutKeys id={panelShortcut(href.slice(1))!} always />
      )}
      <Badge variant="outline" className="text-xs flex-shrink-0">
        Page
      </Badge>
    </button>
  );
}
