'use client';

import { memo, useCallback, useState } from 'react';
import { TableCell, TableRow, Button } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { StaffRoleBadge, StaffStatusBadge } from '@altitutor/ui';
import { formatClassName, formatClassShortName } from '@/shared/utils';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useRouter } from 'next/navigation';
import { useCurrentStaff } from '../hooks/useStaffQuery';
import { LogStaffAbsenceDialog } from '@/features/sessions/components/LogStaffAbsenceDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { SendInviteDialog } from './modal/SendInviteDialog';
import { staffApi } from '../api';
import { useToast } from '@altitutor/ui';

interface StaffTableRowProps {
  staff: Tables<'staff'>;
  classes: (Tables<'classes'> & { subject?: Tables<'subjects'> })[];
  onStaffClick: (id: string) => void;
  onClassClick: (id: string) => void;
  onStaffUpdated?: () => void;
}

export const StaffTableRow = memo(function StaffTableRow({
  staff,
  classes,
  onStaffClick,
  onClassClick,
  onStaffUpdated,
}: StaffTableRowProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { toast } = useToast();
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);

  const handleClick = useCallback(() => {
    onStaffClick(staff.id);
  }, [staff.id, onStaffClick]);

  const handlePasswordResetOrRegistration = useCallback(() => {
    if (!staff.user_id) {
      setInviteDialogOpen(true);
    } else {
      handlePasswordResetRequest();
    }
  }, [staff.user_id]);

  const getPasswordResetLabel = useCallback(() => {
    if (!staff.user_id) {
      return 'Send invite';
    } else {
      return 'Send password reset';
    }
  }, [staff.user_id]);

  const handlePasswordResetRequest = useCallback(async () => {
    if (!staff.email) {
      toast({
        title: "Error",
        description: "No email address found for this staff member.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingPasswordReset(true);
      // TODO: Implement password reset API call
      setHasPasswordResetLinkSent(true);
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPasswordReset(false);
    }
  }, [staff.email, toast]);

  const handleDelete = useCallback(async () => {
    try {
      setIsDeleting(true);
      await staffApi.deleteStaff(staff.id);
      setIsDeleteDialogOpen(false);
      onStaffUpdated?.();
      toast({
        title: 'Staff deleted',
        description: 'Staff member has been deleted successfully.',
      });
    } catch (err) {
      console.error('Failed to delete staff:', err);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [staff.id, onStaffUpdated, toast]);

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleClick}
      >
      <TableCell>
        <StaffStatusBadge value={staff.status as any} />
      </TableCell>
      <TableCell>
        <StaffRoleBadge value={staff.role as any} />
      </TableCell>
      <TableCell className="font-medium">
        {staff.first_name || '-'}
      </TableCell>
      <TableCell className="font-medium">
        {staff.last_name || '-'}
      </TableCell>
      <TableCell>
        {classes.length > 0 ? (
          <div className="flex flex-col gap-1">
            {classes
              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
              .map((cls) => (
                <Button
                  key={cls.id}
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClassClick(cls.id);
                  }}
                  title={formatClassName(cls, cls.subject)}
                >
                  {/* Default to short names, only show full on 2xl+ screens */}
                  <span className="2xl:hidden">{formatClassShortName(cls, cls.subject)}</span>
                  <span className="hidden 2xl:inline">{formatClassName(cls, cls.subject)}</span>
                </Button>
              ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No classes</span>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <ActionsMenu
          type="staff"
          onOpenInPage={() => {
            router.push(`/staff/${staff.id}`);
          }}
          onEditDetails={() => {
            onStaffClick(staff.id);
          }}
          onPasswordResetOrRegistration={handlePasswordResetOrRegistration}
          passwordResetLabel={getPasswordResetLabel()}
          onLogAbsence={() => {
            setIsLogAbsenceDialogOpen(true);
          }}
          onDelete={() => {
            setIsDeleteDialogOpen(true);
          }}
        />
      </TableCell>
    </TableRow>

    {/* Log Staff Absence Dialog */}
    {currentStaff && (
      <LogStaffAbsenceDialog
        isOpen={isLogAbsenceDialogOpen}
        onClose={() => setIsLogAbsenceDialogOpen(false)}
        staffId={currentStaff.id}
        initialStaffId={staff.id}
        allowPastSessions={true}
      />
    )}

    {/* Send Invite Dialog */}
    <SendInviteDialog
      isOpen={inviteDialogOpen}
      onClose={() => setInviteDialogOpen(false)}
      staffMember={staff}
    />

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the staff member
            "{staff.first_name} {staff.last_name}" and all associated data from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}); 