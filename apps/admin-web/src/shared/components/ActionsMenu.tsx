"use client";

import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { Button } from "@altitutor/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useToast,
} from "@altitutor/ui";
import {
  MoreVertical,
  ExternalLink,
  Mail,
  Calendar,
  Download,
  CreditCard,
  Copy,
  Receipt,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { RichTextTemplateMenuItems } from "@/features/rich-text-templates/components/RichTextTemplateMenuItems";

import { recordMenuActions, type RecordMenuAction } from "./recordMenuActions";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import { useOpenPersonMessages } from "@/features/messages/hooks/useOpenPersonMessages";

interface BaseActionsMenuProps {
  onOpenInPage?: () => void;
  entityId?: string;
  copyTagType?: string;
  copyTagDisplayText?: string;
}

interface StudentActionsMenuProps extends BaseActionsMenuProps {
  type: "student";
  onEditDetails: () => void;
  onPasswordResetOrRegistration?: () => void;
  passwordResetLabel?: string;
  onLogAbsence?: () => void;
  onBookTrialSession?: () => void;
  onBookDraftingSession?: () => void;
  onBookSubsidyInterview?: () => void;
  /** Opens global book check-in with this student pre-selected */
  onBookCheckIn?: () => void;
  onAddToHomeworkHelp?: () => void;
  onSendDiscontinuationLink?: () => void;
  onDiscontinue?: () => void;
  /** Re-enroll a discontinued student (status → ACTIVE) */
  onReEnroll?: () => void;
  onDelete: () => void;
}

interface StaffActionsMenuProps extends BaseActionsMenuProps {
  type: "staff";
  onEditDetails: () => void;
  onPasswordResetOrRegistration?: () => void;
  passwordResetLabel?: string;
  onLogAbsence: () => void;
  onBookCheckIn?: () => void;
  onDelete: () => void;
}

interface SessionActionsMenuProps extends BaseActionsMenuProps {
  type: "session";
  onLogSession?: () => void;
  hasTutorLog: boolean;
  onEditTutorLog?: () => void;
  /** Session type; 'CLASS' disables Send Booking Confirmation */
  sessionType?: string;
  /** Students in session; used for Send Booking Confirmation (pick recipient) */
  sessionStudents?: Array<{ id: string; name: string }>;
  onSendBookingConfirmation?: (studentId: string) => void;
}

interface InvoiceActionsMenuProps extends BaseActionsMenuProps {
  type: "invoice";
  /** Hosted invoice URL (customer payment page) */
  onViewPaymentPage?: () => void;
  /** Stripe Dashboard for this invoice */
  onViewInStripe?: () => void;
  onDownloadPdf?: () => void;
  onSendInvoice?: () => void;
  onChargeCard?: () => void;
  onAddCreditNote?: () => void;
  /**
   * When true, visually disable the Add credit note item and show a toast instead
   * of opening the dialog.
   */
  isAddCreditNoteDisabled?: boolean;
  addCreditNoteDisabledReason?: string;
  isLoadingAction?: boolean;
}

interface ClassActionsMenuProps extends BaseActionsMenuProps {
  type: "class";
  onDelete?: () => void;
}

interface AdminShiftActionsMenuProps extends BaseActionsMenuProps {
  type: "adminShift";
  onDelete?: () => void;
}

interface ParentActionsMenuProps extends BaseActionsMenuProps {
  type: "parent";
  onDelete?: () => void;
  onBookCheckIn?: () => void;
}

interface TopicActionsMenuProps extends BaseActionsMenuProps {
  type: "topic";
  onEdit?: () => void;
  onDelete?: () => void;
}

interface SubjectActionsMenuProps extends BaseActionsMenuProps {
  type: "subject";
  onEdit?: () => void;
  onDelete?: () => void;
}

interface TutorLogActionsMenuProps extends BaseActionsMenuProps {
  type: "tutorLog";
  onEdit: () => void;
}

interface RichTextTemplateConfig {
  getEditor: () => Editor | null;
  getCurrentContent: () => JSONContent | string | null;
  onSaveAsTemplateClick?: () => void;
}

interface IssueActionsMenuProps extends BaseActionsMenuProps {
  type: "issue";
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

interface TaskActionsMenuProps extends BaseActionsMenuProps {
  type: "task";
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

interface ProjectActionsMenuProps extends BaseActionsMenuProps {
  type: "project";
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

interface DocumentActionsMenuProps extends BaseActionsMenuProps {
  type: "document";
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

export type ActionsMenuProps =
  | StudentActionsMenuProps
  | StaffActionsMenuProps
  | SessionActionsMenuProps
  | InvoiceActionsMenuProps
  | ClassActionsMenuProps
  | AdminShiftActionsMenuProps
  | ParentActionsMenuProps
  | TopicActionsMenuProps
  | SubjectActionsMenuProps
  | TutorLogActionsMenuProps
  | IssueActionsMenuProps
  | TaskActionsMenuProps
  | ProjectActionsMenuProps
  | DocumentActionsMenuProps;

const DEFAULT_TAG_TYPE_BY_MENU_TYPE: Partial<
  Record<ActionsMenuProps["type"], string>
> = {
  student: "student",
  staff: "staff",
  session: "session",
  invoice: "invoice",
  class: "class",
  adminShift: "admin-shift",
  parent: "parent",
  topic: "topic",
  subject: "subject",
  tutorLog: "tutor-log",
  issue: "issue",
  task: "task",
  project: "project",
  document: "note",
};

export function ActionsMenu(props: ActionsMenuProps) {
  const { toast } = useToast();
  const quickActions = useQuickActions();
  const reference = props.entityId
    ? {
        type:
          props.copyTagType ||
          DEFAULT_TAG_TYPE_BY_MENU_TYPE[props.type] ||
          props.type,
        id: props.entityId,
        label: props.copyTagDisplayText || props.entityId,
      }
    : undefined;

  const messageAction = useOpenPersonMessages(
    props.type === "student" ||
      props.type === "parent" ||
      props.type === "staff"
      ? props.type
      : null,
    props.entityId,
    props.copyTagDisplayText,
  );

  const handleCopyId = async () => {
    if (!props.entityId) return;

    const tagType =
      props.copyTagType || DEFAULT_TAG_TYPE_BY_MENU_TYPE[props.type];
    const displayText = (props.copyTagDisplayText || props.entityId).replace(
      /\]/g,
      "",
    );
    const copyValue = tagType
      ? `@[${tagType}:${props.entityId}:${displayText}]`
      : props.entityId;

    try {
      await navigator.clipboard.writeText(copyValue);
      toast({
        title: "Copied ID",
        description: "Copied taggable ID to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const copyMenuItem = props.entityId ? (
    <DropdownMenuItem onClick={handleCopyId}>
      <Copy className="h-4 w-4 mr-2" />
      Copy ID
    </DropdownMenuItem>
  ) : null;

  const actions = recordMenuActions(props, {
    copy: props.entityId
      ? () => {
          void handleCopyId();
        }
      : undefined,
    message: messageAction.available
      ? () => {
          void messageAction.openMessages();
        }
      : undefined,
    messageDisabled: messageAction.isOpening,
    addIssue: reference
      ? () => quickActions.openCreateIssueDialog(reference)
      : undefined,
    addTask: reference
      ? () => quickActions.openCreateTaskDialog(reference)
      : undefined,
  });
  useRegisterRecordActions(
    props.type,
    props.entityId,
    props.copyTagDisplayText,
    actions,
  );

  if (props.type === "invoice") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={props.isLoadingAction}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {copyMenuItem}
          {actions
            .filter(
              (action) => action.id === "add-task" || action.id === "add-issue",
            )
            .map((action) => (
              <DropdownMenuItem key={action.id} onSelect={action.action}>
                <action.icon className="mr-2 h-4 w-4" />
                {action.title}
              </DropdownMenuItem>
            ))}
          {(props.onViewPaymentPage || props.onViewInStripe) && (
            <>
              <DropdownMenuSeparator />
              {props.onViewPaymentPage && (
                <DropdownMenuItem onClick={props.onViewPaymentPage}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View payment page
                </DropdownMenuItem>
              )}
              {props.onViewInStripe && (
                <DropdownMenuItem onClick={props.onViewInStripe}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Stripe
                </DropdownMenuItem>
              )}
            </>
          )}
          {props.onDownloadPdf && (
            <DropdownMenuItem onClick={props.onDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
          )}
          {props.onSendInvoice && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={props.onSendInvoice}
                disabled={props.isLoadingAction}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Invoice
              </DropdownMenuItem>
            </>
          )}
          {props.onChargeCard && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={props.onChargeCard}
                disabled={props.isLoadingAction}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Charge Card
              </DropdownMenuItem>
            </>
          )}
          {props.onAddCreditNote && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={
                  props.isAddCreditNoteDisabled
                    ? "opacity-60 text-muted-foreground"
                    : undefined
                }
                onClick={() => {
                  if (props.isAddCreditNoteDisabled) {
                    toast({
                      title: "Cannot add credit note",
                      description:
                        props.addCreditNoteDisabledReason ??
                        "This invoice has already been fully credited.",
                      variant: "destructive",
                    });
                    return;
                  }
                  props.onAddCreditNote?.();
                }}
                disabled={props.isLoadingAction}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Add credit note
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const renderAction = (action: RecordMenuAction) => (
    <DropdownMenuItem
      key={action.id}
      disabled={action.disabled}
      onSelect={action.action}
      className={
        action.destructive
          ? "!text-destructive focus:!text-destructive focus:bg-destructive/10"
          : undefined
      }
    >
      <action.icon className="h-4 w-4 mr-2" />
      {action.title}
    </DropdownMenuItem>
  );
  const groups = [
    ...new Set(
      actions
        .map((action) => action.group)
        .filter((group): group is string => !!group),
    ),
  ];
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Record actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions
            .filter((action) => !action.group && !action.destructive)
            .map(renderAction)}
          {"richTextTemplateConfig" in props &&
            props.richTextTemplateConfig && (
              <RichTextTemplateMenuItems {...props.richTextTemplateConfig} />
            )}
          {groups.map((group) => (
            <DropdownMenuSub key={group}>
              <DropdownMenuSubTrigger>
                <Calendar className="h-4 w-4 mr-2" />
                {group}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {actions
                  .filter((action) => action.group === group)
                  .map(renderAction)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          {actions.some((action) => action.destructive) && (
            <DropdownMenuSeparator />
          )}
          {actions.filter((action) => action.destructive).map(renderAction)}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
