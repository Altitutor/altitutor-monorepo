'use client';

import { Button } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Pencil, Mail, Calendar, Trash2, FileText, Download, CalendarX, CreditCard, UserX, Plus } from 'lucide-react';

interface BaseActionsMenuProps {
  onOpenInPage: () => void;
}

interface StudentActionsMenuProps extends BaseActionsMenuProps {
  type: 'student';
  onEditDetails: () => void;
  onPasswordResetOrRegistration: () => void;
  passwordResetLabel: string;
  onLogAbsence: () => void;
  onBookDraftingSession: () => void;
  onAddClass?: () => void;
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
  onReschedule?: () => void;
  canReschedule?: boolean;
}

interface InvoiceActionsMenuProps extends BaseActionsMenuProps {
  type: 'invoice';
  onViewOnStripe?: () => void;
  onDownloadPdf?: () => void;
  onSendInvoice?: () => void;
  onChargeCard?: () => void;
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

interface IssueActionsMenuProps extends BaseActionsMenuProps {
  type: 'issue';
  onDelete: () => void;
}

interface TaskActionsMenuProps extends BaseActionsMenuProps {
  type: 'task';
  onDelete: () => void;
}

type ActionsMenuProps = StudentActionsMenuProps | StaffActionsMenuProps | SessionActionsMenuProps | InvoiceActionsMenuProps | ClassActionsMenuProps | AdminShiftActionsMenuProps | ParentActionsMenuProps | TopicActionsMenuProps | SubjectActionsMenuProps | TutorLogActionsMenuProps | IssueActionsMenuProps | TaskActionsMenuProps;

export function ActionsMenu(props: ActionsMenuProps) {
  if (props.type === 'student') {
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
          {props.onAddClass && (
            <DropdownMenuItem onClick={props.onAddClass}>
              <Plus className="h-4 w-4 mr-2" />
              Add class
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
    );
  }

  if (props.type === 'staff') {
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onDelete} className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete staff
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'session') {
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
          {props.canReschedule && props.onReschedule && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onReschedule}>
                <CalendarX className="h-4 w-4 mr-2" />
                Reschedule session
              </DropdownMenuItem>
            </>
          )}
          {props.hasTutorLog && props.onEditTutorLog && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onEditTutorLog}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit tutor log
              </DropdownMenuItem>
            </>
          )}
          {!props.hasTutorLog && props.onLogSession && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onLogSession}>
                <FileText className="h-4 w-4 mr-2" />
                Log session
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
          {props.onViewOnStripe && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onViewOnStripe}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Stripe
              </DropdownMenuItem>
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

  return null;
}
