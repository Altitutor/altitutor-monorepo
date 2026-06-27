import { useState } from 'react';
import type { Tables } from "@altitutor/shared";
import { Button, Separator } from "@altitutor/ui";
import { Check, Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@altitutor/ui";
import { SendInviteDialog } from '../SendInviteDialog';

interface AccountTabProps {
  staffMember: Tables<'staff'>;
  isLoading: boolean;
  hasPasswordResetLinkSent: boolean;
  isCopyingPasswordResetLink?: boolean;
  isDeleting?: boolean;
  onPasswordResetRequest: () => Promise<void>;
  onCopyPasswordResetLink?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function AccountTab({
  staffMember,
  isLoading,
  hasPasswordResetLinkSent,
  isCopyingPasswordResetLink = false,
  isDeleting = false,
  onPasswordResetRequest,
  onCopyPasswordResetLink,
  onDelete
}: AccountTabProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  return (
    <div className="space-y-6">
      {!staffMember.user_id ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Account Setup</h3>
          <p className="text-sm text-muted-foreground">
            This staff member does not have an associated user account yet. Send them an invite to create one.
          </p>
          
          <Button
            variant="default"
            onClick={() => setInviteDialogOpen(true)}
            className="justify-start w-fit"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Send Invite
          </Button>

          <SendInviteDialog
            isOpen={inviteDialogOpen}
            onClose={() => setInviteDialogOpen(false)}
            staffMember={staffMember}
          />
        </div>
      ) : (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Password Management</h3>
        <p className="text-sm text-muted-foreground">
          Send a password reset link to this staff member&apos;s email address, or copy a link to share manually.
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onPasswordResetRequest}
            disabled={isLoading || hasPasswordResetLinkSent || !staffMember.email}
            className="justify-start w-fit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : hasPasswordResetLinkSent ? (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Reset link sent
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send password reset email
              </>
            )}
          </Button>

          {onCopyPasswordResetLink && (
            <Button
              variant="outline"
              onClick={async () => {
                await onCopyPasswordResetLink();
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              disabled={isCopyingPasswordResetLink || !staffMember.email}
              className="justify-start w-fit"
            >
              {isCopyingPasswordResetLink ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying link...
                </>
              ) : linkCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Link copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy reset link
                </>
              )}
            </Button>
          )}
        </div>

        {!staffMember.email && (
          <p className="text-sm text-orange-600">
            No email address set. Please add an email in the Details tab.
          </p>
        )}
        
        {hasPasswordResetLinkSent && (
          <p className="text-sm text-green-600">
            A password reset link has been sent to {staffMember.email}.
            The staff member needs to check their email to set a new password.
          </p>
        )}
      </div>
      )}

      <Separator className="my-6" />

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete this staff member and their associated data. This action cannot be undone.
        </p>
        
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" type="button" className="flex items-center">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Staff Member
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the staff member
                  "{staffMember.first_name || ''} {staffMember.last_name || ''}" and their user account.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onDelete}
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
        )}
      </div>
    </div>
  );
}
 