import {
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  FileText,
  MessageCircle,
} from "lucide-react";
import {
  accessoryFamily,
  type AccessoryKind,
} from "@/shared/contexts/AccessoryPanelContext";
export function AccessoryIcon({
  kind,
  className = "h-4 w-4 shrink-0",
}: {
  kind: AccessoryKind;
  className?: string;
}) {
  const Icon = {
    tasks: CheckSquare,
    issues: AlertTriangle,
    projects: FolderKanban,
    documents: FileText,
    messages: MessageCircle,
  }[
    accessoryFamily(kind) as
      | "tasks"
      | "issues"
      | "projects"
      | "documents"
      | "messages"
  ];
  return <Icon className={className} aria-hidden="true" />;
}
