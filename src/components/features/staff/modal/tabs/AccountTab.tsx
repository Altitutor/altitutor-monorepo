import { useState } from 'react';
import { Staff, StaffRole } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCog, Mail, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
} from "@/components/ui/alert-dialog";

// Account metadata form schema
const accountFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.nativeEnum(StaffRole),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

interface AccountTabProps {
  staffMember: Staff;
  isLoading: boolean;
  isEditingAccount: boolean;
  hasPasswordResetLinkSent: boolean;
  isDeleting?: boolean;
  onEditAccount: () => void;
  onCancelEditAccount: () => void;
  onAccountUpdate: (data: AccountFormData) => Promise<void>;
  onPasswordResetRequest: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function AccountTab({
  staffMember,
  isLoading,
  isEditingAccount,
  hasPasswordResetLinkSent,
  isDeleting = false,
  onEditAccount,
  onCancelEditAccount,
  onAccountUpdate,
  onPasswordResetRequest,
  onDelete
}: AccountTabProps) {
  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      firstName: staffMember.firstName || '',
      lastName: staffMember.lastName || '',
      role: staffMember.role,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Account Information</h3>
        {!isEditingAccount && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onEditAccount} 
            className="flex items-center gap-2"
          >
            <UserCog className="h-4 w-4" />
            Edit Account
          </Button>
        )}
      </div>

      {isEditingAccount ? (
        <form
          id="account-edit-form"
          onSubmit={accountForm.handleSubmit(onAccountUpdate)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-firstName">First Name</Label>
              <Input
                id="account-firstName"
                {...accountForm.register('firstName')}
                disabled={isLoading}
              />
              {accountForm.formState.errors.firstName && (
                <p className="text-sm text-red-500">
                  {accountForm.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-lastName">Last Name</Label>
              <Input
                id="account-lastName"
                {...accountForm.register('lastName')}
                disabled={isLoading}
              />
              {accountForm.formState.errors.lastName && (
                <p className="text-sm text-red-500">
                  {accountForm.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-role">Role</Label>
            <Controller
              control={accountForm.control}
              name="role"
              render={({ field }) => (
                <Select
                  disabled={isLoading}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="account-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={StaffRole.TUTOR}>
                      Tutor
                    </SelectItem>
                    <SelectItem value={StaffRole.ADMINSTAFF}>
                      Admin Staff
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {accountForm.formState.errors.role && (
              <p className="text-sm text-red-500">
                {accountForm.formState.errors.role.message}
              </p>
            )}
          </div>

          <div className="flex justify-between space-x-2 pt-4">
            {/* Delete staff button */}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" type="button" className="flex items-center">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Staff
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the staff member
                      "{staffMember.firstName || ''} {staffMember.lastName || ''}" and their user account.
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

            <div className="flex space-x-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEditAccount}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            <div className="text-sm font-medium">User ID:</div>
            <div className="text-sm font-mono min-w-0 truncate" title={staffMember.userId}>
              {staffMember.userId}
            </div>

            <div className="text-sm font-medium">Email:</div>
            <div className="min-w-0 truncate" title={staffMember.email ?? ''}>
              {staffMember.email}
            </div>

            <div className="text-sm font-medium">Auth Role:</div>
            <div className="min-w-0">
              {staffMember.role}
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <h3 className="text-md font-medium">Password Management</h3>
            <p className="text-sm text-muted-foreground">
              Send a password reset link to this staff member's email address.
            </p>
            
            <div className="flex flex-col space-y-3">
              <Button
                variant="outline"
                onClick={onPasswordResetRequest}
                disabled={isLoading || hasPasswordResetLinkSent}
                className="justify-start"
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
            </div>
            
            {hasPasswordResetLinkSent && (
              <p className="text-sm text-green-600">
                A password reset link has been sent to {staffMember.email}.
                The staff member needs to check their email to set a new password.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { accountFormSchema };
export type { AccountFormData }; 