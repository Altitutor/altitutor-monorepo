"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button } from "@altitutor/ui";
import { Loader2, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { LoginPageLayout } from "@/features/auth/components";
import { useSupabaseClient } from "@/shared/lib/supabase/client";
import { cn } from "@/shared/utils";
import { tutorBtnPrimary } from "@/shared/lib/tutor-visual";

type ConsentDecision = "approve" | "deny";

type AuthorizationDetails = {
  clientName: string;
  clientId: string;
  clientUri: string | null;
  scopes: string[];
};

function getString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeAuthorizationDetails(value: unknown): {
  details: AuthorizationDetails | null;
  redirectUrl: string | null;
} {
  if (!value || typeof value !== "object") {
    return { details: null, redirectUrl: null };
  }

  const record = value as Record<string, unknown>;
  // Current Supabase OAuth returns redirect_url only when an existing consent
  // can be reused. redirect_uri identifies the client's registered callback
  // and must never be treated as evidence that the user already consented.
  const redirectUrl = getString(record, "redirect_url");
  if (redirectUrl) return { details: null, redirectUrl };

  const client =
    record.client && typeof record.client === "object"
      ? (record.client as Record<string, unknown>)
      : null;
  if (!client) return { details: null, redirectUrl: null };

  const clientName =
    getString(client, "client_name") ??
    getString(client, "name") ??
    "Unknown application";
  const clientUri = getString(client, "client_uri") ?? getString(client, "uri");
  const scope = getString(record, "scope") ?? "";

  return {
    details: {
      clientName,
      clientId: getString(client, "id") ?? getString(client, "client_id") ?? "",
      clientUri,
      scopes: scope.split(/\s+/).filter(Boolean),
    },
    redirectUrl: null,
  };
}

function ConsentPageContent() {
  const supabase = useSupabaseClient();
  const searchParams = useSearchParams();
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [isUcatTutor, setIsUcatTutor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowAdmin, setAllowAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<ConsentDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authorizationId = searchParams.get("authorization_id");

  useEffect(() => {
    let cancelled = false;

    async function loadAuthorization() {
      if (!authorizationId) {
        setError("This authorization request is missing its authorization ID.");
        setLoading(false);
        return;
      }

      const [authorization, access, adminAccess] = await Promise.all([
        supabase.auth.oauth.getAuthorizationDetails(authorizationId),
        supabase.rpc("is_ucat_tutor"),
        supabase.rpc("is_adminstaff_active"),
      ]);

      if (cancelled) return;

      if (authorization.error) {
        setError(authorization.error.message);
        setLoading(false);
        return;
      }

      if (access.error) {
        setError("We could not verify your Altitutor access.");
        setLoading(false);
        return;
      }

      const normalized = normalizeAuthorizationDetails(authorization.data);
      if (normalized.redirectUrl) {
        window.location.assign(normalized.redirectUrl);
        return;
      }

      if (!normalized.details) {
        setError("Supabase returned an invalid authorization request.");
        setLoading(false);
        return;
      }

      setDetails(normalized.details);
      setIsUcatTutor(access.data === true);
      setIsAdmin(!adminAccess.error && adminAccess.data === true);
      setLoading(false);
    }

    void loadAuthorization();

    return () => {
      cancelled = true;
    };
  }, [authorizationId, supabase]);

  async function submitDecision(nextDecision: ConsentDecision) {
    if (
      !authorizationId ||
      (nextDecision === "approve" && !isUcatTutor && !(isAdmin && allowAdmin))
    )
      return;

    setDecision(nextDecision);
    setError(null);

    if (nextDecision === "approve" && isAdmin && allowAdmin) {
      const user = await supabase.auth.getUser();
      if (!user.data.user || !details?.clientId) {
        setError("Unable to identify this authorization.");
        setDecision(null);
        return;
      }
      const { error: grantError } = await supabase
        .from("admin_mcp_grants")
        .upsert(
          { user_id: user.data.user.id, client_id: details.clientId },
          { onConflict: "user_id,client_id", ignoreDuplicates: true },
        );
      if (grantError) {
        setError(grantError.message);
        setDecision(null);
        return;
      }
    }

    const result =
      nextDecision === "approve"
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
      <div
        className="flex min-h-40 items-center justify-center"
        aria-live="polite"
      >
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
              <p className="text-sm text-muted-foreground">
                Application requesting access
              </p>
              <h2 className="break-words text-xl font-semibold">
                {details.clientName}
              </h2>
              {details.clientUri && (
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {details.clientUri}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
            <p className="text-sm font-medium">
              This application will be able to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                {isUcatTutor
                  ? "Read UCAT learning modules, question stems, sets, and mocks."
                  : "Use only the business access you explicitly enable below."}
              </li>
              {isUcatTutor && (
                <li>
                  Create or edit UCAT content as you, including recoverable
                  published changes.
                </li>
              )}
              {isUcatTutor && (
                <li>Use UCAT generation and image-generation tools.</li>
              )}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              UCAT tools cannot publish, unpublish or hard-delete content. Admin
              tools cannot send messages, change scheduling or make payments.
              Changes retain your identity.
            </p>
            {details.scopes.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Identity scopes: {details.scopes.join(", ")}
              </p>
            )}
          </div>

          {isAdmin && (
            <label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
              <input
                type="checkbox"
                checked={allowAdmin}
                onChange={(event) => setAllowAdmin(event.target.checked)}
                className="mt-1"
              />
              <span>
                Allow admin business access: read identifiable business,
                financial, feedback and communication data; create and edit
                projects, tasks, issues, staff documents and notes, including
                tutor visibility. Manage or revoke this access at
                /oauth/admin-access.
              </span>
            </label>
          )}

          {!isUcatTutor && !isAdmin && (
            <Alert variant="destructive">
              <AlertDescription>
                Your account needs active administrator or UCAT tutor access to
                approve this request.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={decision !== null}
              onClick={() => void submitDecision("deny")}
            >
              {decision === "deny" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Deny
            </Button>
            <Button
              type="button"
              className={cn(tutorBtnPrimary, "sm:min-w-28")}
              disabled={
                (!isUcatTutor && !(isAdmin && allowAdmin)) || decision !== null
              }
              onClick={() => void submitDecision("approve")}
            >
              {decision === "approve" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
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
      title="Authorize an application"
      subtitle="Review the Altitutor access this application will receive."
      footer={null}
    >
      <ConsentPageContent />
    </LoginPageLayout>
  );
}
