"use client";

import { Copy, ExternalLink, PanelsTopLeft } from "lucide-react";
import { openReferenceInPane } from "@/shared/components/pane-workspace/pane-routing";
import { toast } from "sonner";
import type { ActionsMenuProps } from "@/shared/components/ActionsMenu";
import {
  recordMenuActions,
  type RecordMenuAction,
} from "@/shared/components/recordMenuActions";
import { useRunRecordAction } from "@/features/command-palette/RecordActionsContext";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { useOpenPersonMessages } from "@/features/messages/hooks/useOpenPersonMessages";
import { openEntityReference } from "@/shared/utils/entityReference";
import type { ReferenceDetails } from "../types";
import { ReferenceActionList } from "./ReferenceActionList";
import { CorrespondenceReferenceActions } from "./CorrespondenceReferenceActions";
import { TemplateReferenceActions } from "./TemplateReferenceActions";
import { studentActionAvailability } from "@/features/students/utils/studentAccountAction";

function actionProps(
  type: string,
  details: ReferenceDetails,
  run: (id: string) => void,
): ActionsMenuProps | null {
  const action = (id: string) => () => run(id);
  const state = details.actionState;
  switch (type) {
    case "student": {
      const { canBook: bookable, canReEnroll } = studentActionAvailability(
        details.status,
        Boolean(state?.deleted),
      );
      return {
        type,
        onEditDetails: action("edit"),
        onDelete: action("delete"),
        onPasswordResetOrRegistration: state?.accountAvailable
          ? action("account")
          : undefined,
        passwordResetLabel: state?.accountLabel,
        onLogAbsence: bookable ? action("absence") : undefined,
        onAddToHomeworkHelp: bookable ? action("homework-help") : undefined,
        onBookTrialSession: bookable ? action("trial") : undefined,
        onBookDraftingSession: bookable ? action("drafting") : undefined,
        onBookSubsidyInterview: bookable ? action("subsidy") : undefined,
        onBookCheckIn: bookable ? action("check-in") : undefined,
        onSendDiscontinuationLink: bookable
          ? action("discontinuation-link")
          : undefined,
        onDiscontinue: bookable ? action("discontinue") : undefined,
        onReEnroll: canReEnroll ? action("re-enroll") : undefined,
      };
    }
    case "staff":
      return {
        type,
        onEditDetails: action("edit"),
        onDelete: action("delete"),
        onLogAbsence: action("absence"),
        onBookCheckIn: action("check-in"),
        onPasswordResetOrRegistration: action("account"),
        passwordResetLabel: state?.accountLabel,
      };
    case "parent":
      return {
        type,
        students: details.linkedStudents,
        onEditDetails: action("edit"),
        onDelete: action("delete"),
        onBookCheckIn: action("check-in"),
      };
    case "class":
      return {
        type,
        onEditDetails: action("edit"),
        onDelete: action("delete"),
      };
    case "session":
      return {
        type,
        onEditDetails: action("edit"),
        hasTutorLog: Boolean(details.logged),
        onLogSession: action("log-session"),
        onEditTutorLog: action("edit-log"),
        sessionType: state?.sessionType,
        sessionStudents: details.people?.filter(
          (person) => person.role === "Student",
        ),
        onSendBookingConfirmation: state?.sessionType && state.sessionType !== "CLASS" ? (studentId) => run(`send-${studentId}`) : undefined,
      };
    case "subject":
    case "topic":
      return { type, onEdit: action("edit"), onDelete: action("delete") };
    case "admin-shift":
    case "adminShift":
      return {
        type: "adminShift",
        onEditDetails: action("edit"),
        onDelete: action("delete"),
      };
    case "tutor-log":
    case "tutorLog":
      return { type: "tutorLog", onEdit: action("edit-log") };
    case "note":
    case "document":
      return { type: "document", onDelete: action("delete") };
    case "task":
    case "project":
    case "issue":
      return { type, onDelete: action("delete") };
    case "invoice":
      return {
        type,
        onViewPaymentPage: state?.hasPaymentPage
          ? action("payment-page")
          : undefined,
        onViewInStripe: state?.hasStripeInvoice ? action("stripe") : undefined,
        onDownloadPdf: state?.hasPdf ? action("pdf") : undefined,
        onSendInvoice:
          details.status !== "paid" ? action("send-invoice") : undefined,
        onChargeCard:
          details.status !== "paid" ? action("charge-card") : undefined,
        onAddCreditNote:
          state?.hasStripeInvoice &&
          (details.status === "paid" || details.status === "open")
            ? action("credit-note")
            : undefined,
      };
    default:
      return null;
  }
}

/** Uses the record menu catalogue; execution stays with the record's existing handlers. */
export function ReferenceActions({
  type,
  id,
  details,
  fallbackTitle,
  onActivate,
}: {
  type: string;
  id: string;
  details?: ReferenceDetails;
  fallbackTitle?: string;
  onActivate?: () => void;
}) {
  const launch = useRunRecordAction();
  const quickActions = useQuickActions();
  const personType =
    type === "student" || type === "parent" || type === "staff" ? type : null;
  const title = details?.title || fallbackTitle || "Preview";
  const messages = useOpenPersonMessages(personType, id, title);
  const normalizedType =
    type === "admin-shift"
      ? "adminShift"
      : type === "tutor-log"
        ? "tutorLog"
        : type === "document"
          ? "note"
          : type;
  const reference = { type, id, label: title };
  const copy = () => {
    void navigator.clipboard
      .writeText(`@[${type}:${id}:${title.replace(/\]/g, "")}]`)
      .then(() => toast.success("Copied ID"))
      .catch(() => toast.error("Could not copy ID"));
  };
  const run = (actionId: string) => {
    if ((type === "tutor-log" || type === "tutorLog") && details?.href) {
      const sessionId = details.href.split("/").pop();
      if (sessionId) launch?.("session", sessionId, actionId);
    } else launch?.(normalizedType, id, actionId);
  };
  const props = details ? actionProps(type, details, run) : null;
  const open: RecordMenuAction = {
    id: "open",
    title: `Open ${type === "note" ? "document" : type === "adminShift" ? "admin shift" : type === "tutorLog" ? "tutor log" : type.replaceAll("-", " ")}`,
    icon: ExternalLink,
    action: () => openEntityReference(type, id),
  };
  const actions = [
    open,
    {
      id: "open-new-pane",
      title: "Open in new pane",
      icon: PanelsTopLeft,
      action: () => { openReferenceInPane(type, id, details?.href); },
    },
    ...(props && !details?.actionState?.deleted
      ? recordMenuActions(props, {
          copy,
          message: messages.available
            ? () => {
                void messages.openMessages();
              }
            : undefined,
          messageDisabled: messages.isOpening,
          addTask: !["task", "project", "issue"].includes(type)
            ? () => quickActions.openCreateTaskDialog(reference)
            : undefined,
          addIssue: !["task", "project", "issue"].includes(type)
            ? () => quickActions.openCreateIssueDialog(reference)
            : undefined,
        })
      : [{ id: "copy-id", title: "Copy ID", icon: Copy, action: copy }]),
  ];
  return (
    <section
      aria-label="Entity actions"
      className="mt-3 space-y-0.5 border-t pt-2"
      onClick={(event) => event.stopPropagation()}
    >
      <ReferenceActionList actions={actions} onActivate={onActivate} />
      {details && (type === "message" || (type === "email" && details.actionState?.emailActionAvailable !== false)) && (
        <CorrespondenceReferenceActions
          type={type}
          id={id}
          details={details}
          onActivate={onActivate}
        />
      )}
      {details && ["task", "project", "issue", "note", "document"].includes(type) && (
        <TemplateReferenceActions type={type} id={id} onActivate={onActivate} />
      )}
    </section>
  );
}
