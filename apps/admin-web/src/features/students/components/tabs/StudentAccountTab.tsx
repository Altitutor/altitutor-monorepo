import type { Tables } from "@altitutor/shared";
import { Button, Separator } from "@altitutor/ui";
import { Loader2, Mail, Trash2 } from "lucide-react";
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

interface StudentAccountTabProps {
  student: Tables<'students'>;
  isLoading: boolean;
  hasPasswordResetLinkSent: boolean;
  isDeleting?: boolean;
  onPasswordResetRequest: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function StudentAccountTab({
  student,
  isLoading,
  hasPasswordResetLinkSent,
  isDeleting = false,
  onPasswordResetRequest,
  onDelete
}: StudentAccountTabProps) {
  return (
    <div className="space-y-6">
      {!student.user_id ? (
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            This student does not have an associated user account.
          </p>
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            disabled={isLoading || hasPasswordResetLinkSent || !((student as any).email || (student as any).student_email)}
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
          
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {!((student as any).email || (student as any).student_email) && (
            <p className="text-sm text-orange-600">
              No email address set. Please add a student email in the Details tab.
            </p>
          )}
            </div>
        
        {hasPasswordResetLinkSent && (
          <>
            <p className="text-sm text-green-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              A password reset link has been sent to {(student as any).email || (student as any).student_email}.
              The student needs to check their email to set a new password.
            </p>
          </>
        )}
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete this student and their associated data. This action cannot be undone.
            </p>
            
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" type="button" className="flex items-center">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Student
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the student
                      "{student.first_name || ''} {student.last_name || ''}" and their user account.
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
        </>
      )}
    </div>
  );
}
 