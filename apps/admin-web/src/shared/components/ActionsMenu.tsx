'use client';

import { useMemo, useState } from 'react';
import { Button } from '@altitutor/ui';
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
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Pencil, Mail, Calendar, Trash2, FileText, Download, CreditCard, UserX, Plus, Copy, Receipt } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { SESSION_QUICK_ACTIONS } from '@/shared/constants/quickActions';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import type { IssueTagInsert } from '@/features/issues/types';

interface BaseActionsMenuProps {
  onOpenInPage: () => void;
  entityId?: string;
  copyTagType?: string;
  copyTagDisplayText?: string;
}

interface StudentActionsMenuProps extends BaseActionsMenuProps {
  type: 'student';
  onEditDetails: () => void;
  onPasswordResetOrRegistration: () => void;
  passwordResetLabel: string;
  onLogAbsence: () => void;
  onBookDraftingSession: () => void;
  onDiscontinue?: () => void;
  onDelete: () => void;
}

interface StaffActionsMenuProps extends BaseActionsMenuProps {
  type: 'staff';
  onEditDetails: () => void;
  onPasswordResetOrRegistration: () => void;
  passwordResetLabel: string;
  onLogAbsence: () => void;
  onDelete: () => void;
}

interface SessionActionsMenuProps extends BaseActionsMenuProps {
  type: 'session';
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
  type: 'invoice';
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
  type: 'class';
  onDelete?: () => void;
}

interface AdminShiftActionsMenuProps extends BaseActionsMenuProps {
  type: 'adminShift';
  onDelete?: () => void;
}

interface ParentActionsMenuProps extends BaseActionsMenuProps {
  type: 'parent';
  onDelete?: () => void;
}

interface TopicActionsMenuProps extends BaseActionsMenuProps {
  type: 'topic';
  onEdit?: () => void;
  onDelete?: () => void;
}

interface SubjectActionsMenuProps extends BaseActionsMenuProps {
  type: 'subject';
  onEdit?: () => void;
  onDelete?: () => void;
}

interface TutorLogActionsMenuProps extends BaseActionsMenuProps {
  type: 'tutorLog';
  onEdit: () => void;
}

interface RichTextTemplateConfig {
  getEditor: () => Editor | null;
  getCurrentContent: () => JSONContent | string | null;
  onSaveAsTemplateClick?: () => void;
}

interface IssueActionsMenuProps extends BaseActionsMenuProps {
  type: 'issue';
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

interface TaskActionsMenuProps extends BaseActionsMenuProps {
  type: 'task';
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

interface ProjectActionsMenuProps extends BaseActionsMenuProps {
  type: 'project';
  onDelete: () => void;
  richTextTemplateConfig?: RichTextTemplateConfig;
}

type ActionsMenuProps = StudentActionsMenuProps | StaffActionsMenuProps | SessionActionsMenuProps | InvoiceActionsMenuProps | ClassActionsMenuProps | AdminShiftActionsMenuProps | ParentActionsMenuProps | TopicActionsMenuProps | SubjectActionsMenuProps | TutorLogActionsMenuProps | IssueActionsMenuProps | TaskActionsMenuProps | ProjectActionsMenuProps;

const DEFAULT_TAG_TYPE_BY_MENU_TYPE: Partial<Record<ActionsMenuProps['type'], string>> = {
  student: 'student',
  staff: 'staff',
  session: 'session',
  invoice: 'invoice',
  class: 'class',
  adminShift: 'adminShift',
  parent: 'parent',
  topic: 'topic',
  subject: 'subject',
  tutorLog: 'tutorLog',
  issue: 'issue',
  task: 'task',
  project: 'project',
};

export function ActionsMenu(props: ActionsMenuProps) {
  const { toast } = useToast();
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);

  const issueInitialTags = useMemo<Omit<IssueTagInsert, 'issue_id'>[]>(() => {
    if (!props.entityId) return [];

    if (props.type === 'student') return [{ student_id: props.entityId }];
    if (props.type === 'staff') return [{ staff_id: props.entityId }];
    if (props.type === 'parent') return [{ parent_id: props.entityId }];
    if (props.type === 'class') return [{ class_id: props.entityId }];
    if (props.type === 'session') return [{ session_id: props.entityId }];

    return [];
  }, [props]);

  const canAddIssue = issueInitialTags.length > 0;

  const handleCopyId = async () => {
    if (!props.entityId) return;

    const tagType = props.copyTagType || DEFAULT_TAG_TYPE_BY_MENU_TYPE[props.type];
    const displayText = (props.copyTagDisplayText || props.entityId).replace(/\]/g, '');
    const copyValue = tagType
      ? `@[${tagType}:${props.entityId}:${displayText}]`
      : props.entityId;

    try {
      await navigator.clipboard.writeText(copyValue);
      toast({
        title: 'Copied ID',
        description: 'Copied taggable ID to clipboard',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const copyMenuItem = props.entityId ? (
    <DropdownMenuItem onClick={handleCopyId}>
      <Copy className="h-4 w-4 mr-2" />
      Copy ID
    </DropdownMenuItem>
  ) : null;

  if (props.type === 'student') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={props.onOpenInPage}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in page
            </DropdownMenuItem>
            {copyMenuItem}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onEditDetails}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onPasswordResetOrRegistration}>
              <Mail className="h-4 w-4 mr-2" />
              {props.passwordResetLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onLogAbsence}>
              <Calendar className="h-4 w-4 mr-2" />
              Log absence
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onBookDraftingSession}>
              <FileText className="h-4 w-4 mr-2" />
              Book drafting session
            </DropdownMenuItem>
            {canAddIssue && (
              <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add issue
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {props.onDiscontinue && (
              <DropdownMenuItem onClick={props.onDiscontinue} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <UserX className="h-4 w-4 mr-2" />
                Discontinue
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete student
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateIssueDialog
          isOpen={isCreateIssueOpen}
          onClose={() => setIsCreateIssueOpen(false)}
          initialTags={issueInitialTags}
        />
      </>
    );
  }

  if (props.type === 'staff') {
    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onEditDetails}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onPasswordResetOrRegistration}>
            <Mail className="h-4 w-4 mr-2" />
            {props.passwordResetLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onLogAbsence}>
            <Calendar className="h-4 w-4 mr-2" />
            Log absence
          </DropdownMenuItem>
          {canAddIssue && (
            <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add issue
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete staff
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        initialTags={issueInitialTags}
      />
      </>
    );
  }

  if (props.type === 'session') {
    const canEditTutorLog = props.hasTutorLog && props.onEditTutorLog;
    const canLogSession = !props.hasTutorLog && props.onLogSession;
    const showEditTutorLog = canEditTutorLog;
    const showLogSession = canLogSession;
    const canSendBookingConfirmation =
      props.sessionType !== 'CLASS' &&
      props.onSendBookingConfirmation &&
      props.sessionStudents &&
      props.sessionStudents.length > 0;
    const sendBookingAction = SESSION_QUICK_ACTIONS.find((a) => a.sessionActionType === 'send-booking-confirmation');
    const SendBookingIcon = sendBookingAction?.icon ?? Mail;

    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          <DropdownMenuSeparator />
          {canSendBookingConfirmation && sendBookingAction && props.sessionStudents && (
            <>
              {props.sessionStudents.length === 1 ? (
                <DropdownMenuItem
                  onClick={() => props.onSendBookingConfirmation!(props.sessionStudents![0].id)}
                >
                  <SendBookingIcon className="h-4 w-4 mr-2" />
                  {sendBookingAction.title}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SendBookingIcon className="h-4 w-4 mr-2" />
                    {sendBookingAction.title}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {props.sessionStudents.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => props.onSendBookingConfirmation!(s.id)}
                      >
                        Send to {s.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {showEditTutorLog ? (
            <DropdownMenuItem onClick={props.onEditTutorLog}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit tutor log
            </DropdownMenuItem>
          ) : showLogSession ? (
            <DropdownMenuItem onClick={props.onLogSession}>
              <FileText className="h-4 w-4 mr-2" />
              Log session
            </DropdownMenuItem>
          ) : null}
          {canAddIssue && (
            <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add issue
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        initialTags={issueInitialTags}
      />
      </>
    );
  }

  if (props.type === 'invoice') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0" disabled={props.isLoadingAction}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
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
              <DropdownMenuItem onClick={props.onSendInvoice} disabled={props.isLoadingAction}>
                <Mail className="h-4 w-4 mr-2" />
                Send Invoice
              </DropdownMenuItem>
            </>
          )}
          {props.onChargeCard && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onChargeCard} disabled={props.isLoadingAction}>
                <CreditCard className="h-4 w-4 mr-2" />
                Charge Card
              </DropdownMenuItem>
            </>
          )}
          {props.onAddCreditNote && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={props.isAddCreditNoteDisabled ? 'opacity-60 text-muted-foreground' : undefined}
                onClick={() => {
                  if (props.isAddCreditNoteDisabled) {
                    toast({
                      title: 'Cannot add credit note',
                      description:
                        props.addCreditNoteDisabledReason ??
                        'This invoice has already been fully credited.',
                      variant: 'destructive',
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

  if (props.type === 'subject') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {props.onEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit subject
              </DropdownMenuItem>
            </>
          )}
          {props.onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete subject
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'topic') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {props.onEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit topic
              </DropdownMenuItem>
            </>
          )}
          {props.onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete topic
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'tutorLog') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open session in page
          </DropdownMenuItem>
          {copyMenuItem}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit tutor log
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'class') {
    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {canAddIssue && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add issue
              </DropdownMenuItem>
            </>
          )}
          {props.onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete class
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        initialTags={issueInitialTags}
      />
      </>
    );
  }

  if (props.type === 'adminShift') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {canAddIssue && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add issue
              </DropdownMenuItem>
            </>
          )}
          {props.onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete admin shift
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'parent') {
    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {canAddIssue && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateIssueOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add issue
              </DropdownMenuItem>
            </>
          )}
          {props.onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete parent
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        initialTags={issueInitialTags}
      />
      </>
    );
  }

  if (props.type === 'issue') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {props.richTextTemplateConfig && (
            <RichTextTemplateMenuItems
              getEditor={props.richTextTemplateConfig.getEditor}
              getCurrentContent={props.richTextTemplateConfig.getCurrentContent}
              onSaveAsTemplateClick={props.richTextTemplateConfig.onSaveAsTemplateClick}
            />
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={props.onDelete}
            className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete issue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'task') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {props.richTextTemplateConfig && (
            <RichTextTemplateMenuItems
              getEditor={props.richTextTemplateConfig.getEditor}
              getCurrentContent={props.richTextTemplateConfig.getCurrentContent}
              onSaveAsTemplateClick={props.richTextTemplateConfig.onSaveAsTemplateClick}
            />
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={props.onDelete}
            className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'project') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={props.onOpenInPage}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in page
          </DropdownMenuItem>
          {copyMenuItem}
          {props.richTextTemplateConfig && (
            <RichTextTemplateMenuItems
              getEditor={props.richTextTemplateConfig.getEditor}
              getCurrentContent={props.richTextTemplateConfig.getCurrentContent}
              onSaveAsTemplateClick={props.richTextTemplateConfig.onSaveAsTemplateClick}
            />
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={props.onDelete}
            className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}
