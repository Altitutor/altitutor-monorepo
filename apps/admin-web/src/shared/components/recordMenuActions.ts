import type { ReactNode } from "react";
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
  Download,
  CreditCard,
  Receipt,
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
  renderTitle?: ReactNode;
  context?: { type: string; id: string; label: string };
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
  messageStudents?: () => void;
  messageStaff?: () => void;
  bulkMessageDisabled?: boolean;
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
  const entityLabel =
    props.type === "adminShift"
      ? "admin shift"
      : props.type === "tutorLog"
        ? "tutor log"
        : props.type;
  add("open", `Open ${entityLabel}`, ExternalLink, props.onOpenInPage);
  add("copy-id", "Copy ID", Copy, common.copy);
  add("message", "Message", MessageSquare, common.message, {
    disabled: common.messageDisabled,
  });
  if (props.type === "class" || props.type === "session") {
    add(
      "message-students",
      "Message students",
      MessageSquare,
      common.messageStudents,
      { disabled: common.bulkMessageDisabled },
    );
    add("message-staff", "Message staff", MessageSquare, common.messageStaff, {
      disabled: common.bulkMessageDisabled,
    });
  }
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
      add("edit", "Edit details", Pencil, props.onEditDetails);
      add("check-in", "Book check in", ClipboardCheck, props.onBookCheckIn, {
        group: "Book meeting",
      });
      add("delete", "Delete parent", Trash2, props.onDelete, {
        destructive: true,
      });
      break;
    case "session": {
      add("edit", "Edit details", Pencil, props.onEditDetails);
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
      add("edit", "Edit details", Pencil, props.onEditDetails);
      add(
        "delete",
        props.type === "class" ? "Delete class" : "Delete admin shift",
        Trash2,
        props.onDelete,
        { destructive: true },
      );
      break;
    case "tutorLog":
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
      add(
        "payment-page",
        "View payment page",
        ExternalLink,
        props.onViewPaymentPage,
      );
      add("stripe", "View in Stripe", ExternalLink, props.onViewInStripe);
      add("pdf", "Download PDF", Download, props.onDownloadPdf);
      add("send-invoice", "Send Invoice", Mail, props.onSendInvoice, {
        disabled: props.isLoadingAction,
      });
      add("charge-card", "Charge Card", CreditCard, props.onChargeCard, {
        disabled: props.isLoadingAction,
      });
      add("credit-note", "Add credit note", Receipt, props.onAddCreditNote, {
        disabled: props.isLoadingAction || props.isAddCreditNoteDisabled,
      });
      break;
  }
  return actions;
}
