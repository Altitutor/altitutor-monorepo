'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { isRecoveryFlow, otpTypeFromParam, safeNextPath } from './auth-callback-utils';

/**
 * Completes auth flows in the browser so PKCE verifiers use the tutor-auth cookie store.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const typeParam = searchParams.get('type');
    const next = safeNextPath(searchParams.get('next'), typeParam);
    const recoveryFlow = isRecoveryFlow(typeParam, next);

    const finish = (errorMessage: string) => {
      setMessage(errorMessage);
      const errorPath = recoveryFlow
        ? `/forgot-password?error=${encodeURIComponent(errorMessage)}`
        : `/login?error=${encodeURIComponent(errorMessage)}`;
      router.replace(errorPath);
    };

    void (async () => {
      if (tokenHash) {
        const typesToTry = otpTypeFromParam(typeParam);
        let lastVerifyError: { message: string } | null = null;
        for (const otpType of typesToTry) {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (!error) {
            router.replace(next);
            return;
          }
          lastVerifyError = error;
        }
        finish(lastVerifyError?.message ?? 'auth_failed');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            router.replace(next);
            return;
          }
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.error('[auth/callback] exchangeCodeForSession:', error);
          }
          const isPkceVerifierMissing = error.message
            .toLowerCase()
            .includes('code verifier');
          finish(
            isPkceVerifierMissing
              ? recoveryFlow
                ? 'This reset link only works in the same browser where you requested it. Request a new reset email and open the link from that browser, or ask an admin to copy a reset link for you.'
                : 'This sign-in link only works in the same browser where you requested it.'
              : error.message,
          );
          return;
        }
        router.replace(next);
        return;
      }

      finish('auth_failed');
    })();
  }, [router, searchParams, supabase]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 text-center text-sm text-muted-foreground dark:bg-brand-dark-bg">
      {message}
    </div>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 text-sm text-muted-foreground dark:bg-brand-dark-bg">
          Completing sign-in…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
