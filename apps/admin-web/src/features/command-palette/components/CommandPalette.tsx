"use client";
import {
  CheckSquare,
  AlertTriangle,
  Calendar,
  MessageCircle,
  FileText,
  FolderKanban,
} from "lucide-react";
import { navItems as sidebarItems } from "@/shared/constants/adminNavigation";
import { settingsSections } from "@/shared/constants/adminSettings";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import {
  additionalPages,
  extractPagesFromNavItems,
} from "../config/commandPalette.config";
import { useCommandPaletteCommandActions } from "../hooks/useCommandPaletteActions";
import { useCommandPaletteCommands } from "../hooks/useCommandPaletteCommands";
import { useRecordCommands } from "../RecordActionsContext";
import { searchPaletteEntities } from "../api/search";
import { PaletteBrowser } from "./PaletteBrowser";
import type { PaletteEntityType } from "../model";

const sidebarPages = sidebarItems.flatMap((item) =>
  item.type === "heading"
    ? []
    : [
        item,
        ...(item.children ?? []).map((child) => ({
          ...child,
          icon: item.icon,
        })),
      ],
);
export const navItems = [
  ...sidebarPages,
  { title: "Issues", href: "/issues", icon: AlertTriangle },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Messages", href: "/messages", icon: MessageCircle },
  { title: "Admin Shifts", href: "/admin-shifts", icon: Calendar },
  { title: "Documents", href: "/documents", icon: FileText },
  ...settingsSections.flatMap((section) => section.items),
];
const allPages = [
  ...new Map(
    [...extractPagesFromNavItems(navItems), ...additionalPages].map((page) => [
      page.href,
      page,
    ]),
  ).values(),
];
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onEntitySelected?: (type: string, id: string) => void;
  onCreateDocument: () => void;
}
export function CommandPalette({
  isOpen,
  onClose,
  onEntitySelected,
  onCreateDocument,
}: CommandPaletteProps) {
  const { router } = usePaneNavigation();
  const commandActions = useCommandPaletteCommandActions(onClose);
  const { commandsWithActions } = useCommandPaletteCommands({ commandActions });
  const recordCommands = useRecordCommands();
  const commands = [
    ...(commandActions ? commandsWithActions.filter(
          (command) =>
            !recordCommands.some((record) =>
              record.id.endsWith(`-${command.id}`),
            ),
        )
      : []),
    {
      id: "create-document",
      title: "Document",
      icon: FileText,
      keywords: ["new", "create", "note"],
      action: onCreateDocument,
    },
    ...recordCommands,
  ];
  return (
    <>
      <PaletteBrowser
        isOpen={isOpen}
        onClose={onClose}
        onEntitySelected={(type: PaletteEntityType, id) =>
          onEntitySelected?.(type, id)
        }
        commands={commands}
        pages={allPages}
        onPageSelected={(href) => router.push(href)}
        searchEntities={searchPaletteEntities}
      />
    </>
  );
}
