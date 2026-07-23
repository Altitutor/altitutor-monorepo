'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, Button } from '@altitutor/ui';
import { Loader2, ShieldCheck } from 'lucide-react';
import { LoginPageLayout } from '@/features/auth/components';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { cn } from '@/shared/utils';
import { tutorBtnPrimary } from '@/shared/lib/tutor-visual';

type ConsentDecision = 'approve' | 'deny';

type AuthorizationDetails = {
  authorization_id: string;
  redirect_uri?: string;
  client: {
    client_id: string;
    client_name: string;
    client_uri: string;
    logo_uri: string;
  };
  user: {
    id: string;
    email: string;
  };
  scope: string;
};

function ConsentPageContent() {
  const supabase = useSupabaseClient();
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [isUcatTutor, setIsUcatTutor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<ConsentDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authorizationId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('authorization_id');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthorization() {
      if (!authorizationId) {
        setError('This authorization request is missing its authorization ID.');
        setLoading(false);
        return;
      }

      const [authorization, access] = await Promise.all([
        supabase.auth.oauth.getAuthorizationDetails(authorizationId),
        supabase.rpc('is_ucat_tutor'),
      ]);

      if (cancelled) return;

      if (authorization.error) {
        setError(authorization.error.message);
        setLoading(false);
        return;
      }

      if (access.error) {
        setError('We could not verify your UCAT authoring access.');
        setLoading(false);
        return;
      }

      if (authorization.data.redirect_uri) {
        window.location.assign(authorization.data.redirect_uri);
        return;
      }

      setDetails(authorization.data);
      setIsUcatTutor(access.data === true);
      setLoading(false);
    }

    void loadAuthorization();

    return () => {
      cancelled = true;
    };
  }, [authorizationId, supabase]);

  async function submitDecision(nextDecision: ConsentDecision) {
    if (!authorizationId || (nextDecision === 'approve' && !isUcatTutor)) return;

    setDecision(nextDecision);
    setError(null);

    const result =
      nextDecision === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          });

    if (result.error) {
      setError(result.error.message);
      setDecision(null);
      return;
    }

    window.location.assign(result.data.redirect_url);
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading authorization request</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {details && (
        <>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Application requesting access</p>
              <h2 className="break-words text-xl font-semibold">{details.client.client_name}</h2>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {details.client.client_uri}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
            <p className="text-sm font-medium">This application will be able to:</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Read UCAT learning modules, question stem units, sets, and mocks.</li>
              <li>Create or edit draft and in-review UCAT content as you.</li>
              <li>Use the existing UCAT generation and image-generation pathways.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              It cannot publish content or edit published content. All changes retain your tutor
              identity and are recorded in the MCP audit trail.
            </p>
          </div>

          {!isUcatTutor && (
            <Alert variant="destructive">
              <AlertDescription>
                Your account does not have UCAT tutor access, so this request cannot be approved.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={decision !== null}
              onClick={() => void submitDecision('deny')}
            >
              {decision === 'deny' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deny
            </Button>
            <Button
              type="button"
              className={cn(tutorBtnPrimary, 'sm:min-w-28')}
              disabled={!isUcatTutor || decision !== null}
              onClick={() => void submitDecision('approve')}
            >
              {decision === 'approve' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Allow
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function OAuthConsentPage() {
  return (
    <LoginPageLayout
      title="Authorize Codex"
      subtitle="Review access to Altitutor's UCAT authoring tools."
      footer={null}
    >
      <ConsentPageContent />
    </LoginPageLayout>
  );
}
