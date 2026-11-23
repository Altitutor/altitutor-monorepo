"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { EntityChipIcon } from "@altitutor/ui";
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
  KeyboardShortcut,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
import { usePathname } from 'next/navigation';
import { RichTextTemplateMenuItems, RichTextTemplateRecordActions } from "@/features/rich-text-templates/components/RichTextTemplateMenuItems";

import { recordMenuActions, type RecordMenuAction } from "./recordMenuActions";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import { useOpenPersonMessages } from "@/features/messages/hooks/useOpenPersonMessages";
import { EmailActionGroup } from "@/features/email/components/EmailActions";

interface BaseActionsMenuProps {
  detailsInSidebar?: boolean;
  menuOnly?: boolean;
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
  onEditDetails?: () => void;
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
  onEditDetails?: () => void;
  onDelete?: () => void;
}

interface AdminShiftActionsMenuProps extends BaseActionsMenuProps {
  type: "adminShift";
  onEditDetails?: () => void;
  onDelete?: () => void;
}

interface ParentActionsMenuProps extends BaseActionsMenuProps {
  type: "parent";
  students?: ReadonlyArray<{ id: string; name: string }>;
  onEditDetails?: () => void;
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
  const pathname = usePathname();
  const { toast } = useToast();
  const quickActions = useQuickActions();
  const [loadingBulk, setLoadingBulk] = useState(false);
  const openBulkMembers = async (kind: "student" | "staff") => {
    if (
      !props.entityId ||
      (props.type !== "class" && props.type !== "session") ||
      loadingBulk
    )
      return;
    setLoadingBulk(true);
    try {
      const db = getSupabaseClient();
      const ids: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const table =
          props.type === "class"
            ? kind === "student"
              ? "classes_students"
              : "classes_staff"
            : kind === "student"
              ? "sessions_students"
              : "sessions_staff";
        const query = db
          .from(table)
          .select(kind === "student" ? "student_id" : "staff_id");
        const filtered = query.filter(
          props.type === "class" ? "class_id" : "session_id",
          "eq",
          props.entityId,
        );
        const endColumn =
          kind === "student" ? "unenrolled_at" : "unassigned_at";
        const active =
          props.type === "class"
            ? filtered.or(
                `${endColumn}.is.null,${endColumn}.gt.${new Date().toISOString()}`,
              )
            : filtered;
        const { data, error } = await active
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        for (const row of data ?? []) {
          const record: unknown = row;
          const key = kind === "student" ? "student_id" : "staff_id";
          if (record && typeof record === "object" && key in record) {
            const id = (record as Record<string, unknown>)[key];
            if (typeof id === "string") ids.push(id);
          }
        }
        if (!data || data.length < 1000) break;
      }
      if (!ids.length) {
        toast({
          title: `No ${kind === "staff" ? "staff" : "students"} in this ${props.type}`,
        });
        return;
      }
      quickActions.openAnnouncementsModal(
        kind === "student" ? [...new Set(ids)] : [],
        kind === "staff" ? [...new Set(ids)] : [],
      );
    } catch {
      toast({
        title: "Unable to load message recipients",
        variant: "destructive",
      });
    } finally {
      setLoadingBulk(false);
    }
  };
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

  const canAddRelatedWork = reference && !["task", "project", "issue"].includes(props.type);
  const allActions = recordMenuActions(props, {
    messageStudents: () => { void openBulkMembers('student'); },
    messageStaff: () => { void openBulkMembers('staff'); },
    bulkMessageDisabled: loadingBulk,
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
    addIssue: canAddRelatedWork
      ? () => quickActions.openCreateIssueDialog(reference)
      : undefined,
    addTask: canAddRelatedWork
      ? () => quickActions.openCreateTaskDialog(reference)
      : undefined,
  });
  const route = props.type === 'class' ? 'classes' : props.type === 'staff' ? 'staff' : props.type === 'adminShift' ? 'admin-shifts' : props.type === 'document' ? 'documents' : `${props.type}s`;
  const isOwnPage = Boolean(props.entityId && pathname?.endsWith(`/${route}/${props.entityId}`));
  const actions = allActions.filter((action) => !(isOwnPage && action.id === 'open') && !(props.detailsInSidebar && action.id === 'edit'));
  useRegisterRecordActions(
    props.type,
    props.entityId,
    props.copyTagDisplayText,
    allActions,
  );

  if (props.type === "invoice") {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={props.isLoadingAction}
            data-shortcut-menu aria-keyshortcuts="M" aria-label="Invoice actions"
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
      className={action.destructive ? "!text-destructive focus:!text-destructive focus:bg-destructive/10" : undefined}
    >
      <span className="mr-2 flex size-4 shrink-0 items-center justify-center">
        {action.id === "add-task" || action.id === "add-issue"
          ? <EntityChipIcon entityType={action.id === "add-task" ? "task" : "issue"} />
          : <action.icon className="size-4" />}
      </span>
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
    <div className="flex items-center gap-2">
      {'richTextTemplateConfig' in props && props.richTextTemplateConfig && <RichTextTemplateRecordActions type={props.type} id={props.entityId} title={props.copyTagDisplayText} config={props.richTextTemplateConfig} />}
      <EmailActionGroup label="Common record actions">
        <TooltipProvider delayDuration={0}>
          {!props.menuOnly && actions.filter((action) => action.primaryOnly).map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label={action.title} onClick={action.action}>
                  <EntityChipIcon entityType={action.id === "add-task" ? "task" : "issue"} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.title}</TooltipContent>
            </Tooltip>
          ))}
          <DropdownMenu modal={false}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    data-shortcut-menu aria-keyshortcuts="M" aria-label="Record actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-2">Record actions<KeyboardShortcut keys={["M"]}/></TooltipContent>
            </Tooltip>
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
        </TooltipProvider>
      </EmailActionGroup>
    </div>
  );
}
