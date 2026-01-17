'use client';

import { Button } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Pencil, Mail, Calendar, Trash2, FileText, Download, CalendarX } from 'lucide-react';

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
  onReschedule?: () => void;
  canReschedule?: boolean;
}

interface InvoiceActionsMenuProps extends BaseActionsMenuProps {
  type: 'invoice';
  onViewOnStripe?: () => void;
  onDownloadPdf?: () => void;
}

interface ClassActionsMenuProps extends BaseActionsMenuProps {
  type: 'class';
}

interface AdminShiftActionsMenuProps extends BaseActionsMenuProps {
  type: 'adminShift';
}

type ActionsMenuProps = StudentActionsMenuProps | StaffActionsMenuProps | SessionActionsMenuProps | InvoiceActionsMenuProps | ClassActionsMenuProps | AdminShiftActionsMenuProps;

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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onDelete} className="text-destructive focus:text-destructive">
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
          <DropdownMenuItem onClick={props.onDelete} className="text-destructive focus:text-destructive">
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
          <Button variant="outline" size="icon" className="shrink-0">
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
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (props.type === 'class' || props.type === 'adminShift') {
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
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}
