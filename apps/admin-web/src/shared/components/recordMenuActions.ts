import {
  Calendar,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { ActionsMenuProps } from "./ActionsMenu";
import { SESSION_QUICK_ACTIONS } from "@/shared/constants/quickActions";

export type RecordMenuAction = {
  id: string;
  title: string;
  icon: LucideIcon;
  action: () => void;
  disabled?: boolean;
  destructive?: boolean;
  group?: string;
  primaryOnly?: boolean;
};
type CommonActions = {
  copy?: () => void;
  message?: () => void;
  messageDisabled?: boolean;
  addIssue?: () => void;
  addTask?: () => void;
};

/** One catalogue for record menus and palette commands. Callbacks retain page-owned guards/dialogs. */
export function recordMenuActions(
  props: ActionsMenuProps,
  common: CommonActions,
): RecordMenuAction[] {
  const actions: RecordMenuAction[] = [];
  const add = (
    id: string,
    title: string,
    icon: LucideIcon,
    action?: () => void,
    options: Partial<RecordMenuAction> = {},
  ) => {
    if (action) actions.push({ id, title, icon, action, ...options });
  };
  add("copy-id", "Copy ID", Copy, common.copy);
  add("message", "Message", MessageSquare, common.message, {
    disabled: common.messageDisabled,
  });
  add("add-task", "Add task", Plus, common.addTask, { primaryOnly: true });
  add("add-issue", "Add issue", Plus, common.addIssue, { primaryOnly: true });
  switch (props.type) {
    case "student":
      add("edit", "Edit details", Pencil, props.onEditDetails);
      if (props.passwordResetLabel)
        add(
          "account",
          props.passwordResetLabel,
          Mail,
          props.onPasswordResetOrRegistration,
        );
      add("absence", "Log absence", Calendar, props.onLogAbsence);
      add(
        "homework-help",
        "Add to homework help",
        Calendar,
        props.onAddToHomeworkHelp,
      );
      add("trial", "Book trial session", Calendar, props.onBookTrialSession, {
        group: "Book meeting",
      });
      add(
        "drafting",
        "Book drafting session",
        FileText,
        props.onBookDraftingSession,
        { group: "Book meeting" },
      );
      add(
        "subsidy",
        "Book subsidy interview",
        Calendar,
        props.onBookSubsidyInterview,
        { group: "Book meeting" },
      );
      add("check-in", "Book check in", ClipboardCheck, props.onBookCheckIn, {
        group: "Book meeting",
      });
      add("re-enroll", "Re-enroll", UserCheck, props.onReEnroll);
      add(
        "discontinuation-link",
        "Send discontinuation link",
        Mail,
        props.onSendDiscontinuationLink,
      );
      add("discontinue", "Discontinue", UserX, props.onDiscontinue, {
        destructive: true,
      });
      add("delete", "Delete student", Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "staff":
      add("edit", "Edit details", Pencil, props.onEditDetails);
      if (props.passwordResetLabel)
        add(
          "account",
          props.passwordResetLabel,
          Mail,
          props.onPasswordResetOrRegistration,
        );
      add("absence", "Log absence", Calendar, props.onLogAbsence);
      add("check-in", "Book check in", ClipboardCheck, props.onBookCheckIn, {
        group: "Book meeting",
      });
      add("delete", "Delete staff", Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "parent":
      add("check-in", "Book check in", ClipboardCheck, props.onBookCheckIn, {
        group: "Book meeting",
      });
      add("delete", "Delete parent", Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "session": {
      const booking = SESSION_QUICK_ACTIONS.find(
        (action) => action.sessionActionType === "send-booking-confirmation",
      );
      if (
        props.sessionType !== "CLASS" &&
        booking &&
        props.onSendBookingConfirmation
      ) {
        for (const student of props.sessionStudents ?? [])
          add(
            `send-${student.id}`,
            (props.sessionStudents?.length ?? 0) > 1
              ? `Send to ${student.name}`
              : booking.title,
            booking.icon,
            () => props.onSendBookingConfirmation?.(student.id),
            {
              group:
                (props.sessionStudents?.length ?? 0) > 1
                  ? booking.title
                  : undefined,
            },
          );
      }
      if (props.hasTutorLog)
        add("edit-log", "Edit tutor log", Pencil, props.onEditTutorLog);
      else add("log-session", "Log session", FileText, props.onLogSession);
      break;
    }
    case "subject":
    case "topic":
      add("edit", `Edit ${props.type}`, Pencil, props.onEdit);
      add("delete", `Delete ${props.type}`, Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "class":
    case "adminShift":
      add(
        "delete",
        props.type === "class" ? "Delete class" : "Delete admin shift",
        Trash2,
        props.onDelete,
        { destructive: true },
      );
      break;
    case "tutorLog":
      add("open", "Open session in page", ExternalLink, props.onOpenInPage);
      add("edit", "Edit tutor log", Pencil, props.onEdit);
      break;
    case "task":
    case "issue":
    case "project":
    case "document":
      add("delete", `Delete ${props.type}`, Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "invoice":
      break; // Billing retains its existing specialized menu.
  }
  return actions;
}
