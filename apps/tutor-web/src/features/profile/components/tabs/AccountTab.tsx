'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { authApi } from '@/features/auth/api';
import type { Database } from '@altitutor/shared';

type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];

interface AccountTabProps {
  profile: TutorProfile;
}

export function AccountTab({ profile }: AccountTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  const handlePasswordResetRequest = async () => {
    if (!profile.email) {
      toast({
        title: 'Error',
        description: 'No email address found. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await authApi.requestPasswordReset({ email: profile.email });
      
      setHasPasswordResetLinkSent(true);
      
      toast({
        title: 'Success',
        description: 'Password reset link sent successfully. Please check your email.',
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send password reset link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Account</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send a password reset link to your email address.
        </p>
        
        <div className="flex flex-col space-y-3">
          <Button
            variant="outline"
            onClick={handlePasswordResetRequest}
            disabled={isLoading || hasPasswordResetLinkSent || !profile.email}
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
          
          {!profile.email && (
            <p className="text-sm text-orange-600">
              No email address found. Please contact support.
            </p>
          )}
        </div>
      
        {hasPasswordResetLinkSent && (
          <p className="text-sm text-green-600">
            A password reset link has been sent to {profile.email}.
            Please check your email to set a new password.
          </p>
        )}
      </div>
    </div>
  );
}

