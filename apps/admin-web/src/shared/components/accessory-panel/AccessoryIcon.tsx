import {
  CalendarDays,
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  FileText,
  MessageCircle,
  Mail,
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
    today: CalendarDays,
    tasks: CheckSquare,
    issues: AlertTriangle,
    projects: FolderKanban,
    documents: FileText,
    messages: MessageCircle,
    email: Mail,
  }[
    accessoryFamily(kind) as
      | "today"
      | "tasks"
      | "issues"
      | "projects"
      | "documents"
      | "messages"
      | "email"
  ];
  return <Icon className={className} aria-hidden="true" />;
}
