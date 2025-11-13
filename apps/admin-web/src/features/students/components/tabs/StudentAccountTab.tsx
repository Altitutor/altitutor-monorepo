import { useState } from 'react';
import type { Tables } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { SendInviteDialog } from '../SendInviteDialog';

interface StudentAccountTabProps {
  student: Tables<'students'>;
  isLoading: boolean;
  hasPasswordResetLinkSent: boolean;
  onPasswordResetRequest: () => Promise<void>;
}

export function StudentAccountTab({
  student,
  isLoading,
  hasPasswordResetLinkSent,
  onPasswordResetRequest
}: StudentAccountTabProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {!student.user_id ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Account Setup</h3>
          <p className="text-sm text-muted-foreground">
            This student does not have an associated user account yet. Send them an invite to create one.
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
            student={student}
          />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Password Management</h3>
            <p className="text-sm text-muted-foreground">
              Send a password reset link to this student's email address.
            </p>
            
            <div className="flex flex-col space-y-3">
          <Button
            variant="outline"
            onClick={onPasswordResetRequest}
            disabled={isLoading || hasPasswordResetLinkSent || !student.email}
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
          
          {!student.email && (
            <p className="text-sm text-orange-600">
              No email address set. Please add a student email in the Details tab.
            </p>
          )}
            </div>
        
        {hasPasswordResetLinkSent && (
          <>
            <p className="text-sm text-green-600">
              A password reset link has been sent to {student.email}.
              The student needs to check their email to set a new password.
            </p>
          </>
        )}
          </div>
        </>
      )}
    </div>
  );
}
 