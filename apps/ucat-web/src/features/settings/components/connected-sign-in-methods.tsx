"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { UserIdentity } from "@supabase/supabase-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useToast,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildSocialAuthCallbackUrl,
  SOCIAL_AUTH_PROVIDERS,
  type SocialAuthProvider,
} from "@/features/auth/lib/social-auth";
import { SettingsRow } from "@/features/settings/components/settings-row";

const PROVIDER_LABEL: Record<SocialAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

function identityEmail(identity: UserIdentity | undefined): string | null {
  const value = identity?.identity_data?.email;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function ConnectedSignInMethods({
  enabledProviders,
}: {
  enabledProviders: SocialAuthProvider[];
}) {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<SocialAuthProvider | null>(
    null,
  );
  const [unlinkProvider, setUnlinkProvider] =
    useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("identity_error"),
  );
  const linkedToastShownRef = useRef(false);

  const loadIdentities = useCallback(async () => {
    const { data, error: identitiesError } =
      await supabase.auth.getUserIdentities();
    if (identitiesError) {
      setError(identitiesError.message || "Could not load sign-in methods.");
      setIsLoading(false);
      return;
    }
    setIdentities(data.identities);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    const linkedProvider = searchParams.get("provider");
    if (
      !linkedToastShownRef.current &&
      searchParams.get("linked") === "1" &&
      (linkedProvider === "google" || linkedProvider === "apple")
    ) {
      linkedToastShownRef.current = true;
      toast({
        title: `${PROVIDER_LABEL[linkedProvider]} connected`,
        description: `You can now sign in with ${PROVIDER_LABEL[linkedProvider]}.`,
      });
    }
  }, [searchParams, toast]);

  async function link(provider: SocialAuthProvider) {
    setBusyProvider(provider);
    setError(null);
    const callbackUrl = buildSocialAuthCallbackUrl({
      origin: window.location.origin,
      intent: "link",
      provider,
      next: "/settings/profile",
    });
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (linkError) {
      setError(
        linkError.message || `Could not connect ${PROVIDER_LABEL[provider]}.`,
      );
      setBusyProvider(null);
    }
  }

  async function unlink() {
    if (!unlinkProvider) return;
    const identity = identities.find(
      (candidate) => candidate.provider === unlinkProvider,
    );
    if (!identity) {
      setUnlinkProvider(null);
      return;
    }

    setBusyProvider(unlinkProvider);
    setError(null);
    const provider = unlinkProvider;
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
    if (unlinkError) {
      setError(
        unlinkError.code === "single_identity_not_deletable"
          ? "Supabase requires another linked identity before this method can be removed. Connect the other provider first."
          : unlinkError.message ||
              `Could not remove ${PROVIDER_LABEL[provider]}.`,
      );
      setBusyProvider(null);
      setUnlinkProvider(null);
      return;
    }

    await loadIdentities();
    setBusyProvider(null);
    setUnlinkProvider(null);
    toast({
      title: `${PROVIDER_LABEL[provider]} removed`,
      description: `You can no longer sign in with ${PROVIDER_LABEL[provider]}.`,
    });
  }

  const canRemoveIdentity = identities.length >= 2;

  return (
    <>
      <SettingsRow
        title="Sign-in methods"
        description="Connect Google or Apple to the same Student account. Connecting a provider does not change your primary email."
        control={
          <div className="w-full space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Email and password
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Connected</p>
            </div>

            {SOCIAL_AUTH_PROVIDERS.map((provider) => {
              const identity = identities.find(
                (candidate) => candidate.provider === provider,
              );
              const connected = Boolean(identity);
              const enabled = enabledProviders.includes(provider);
              if (!connected && !enabled) return null;

              return (
                <div
                  key={provider}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {PROVIDER_LABEL[provider]}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {connected
                        ? identityEmail(identity) || "Connected"
                        : "Not connected"}
                    </p>
                  </div>
                  {connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyProvider !== null || !canRemoveIdentity}
                      onClick={() => setUnlinkProvider(provider)}
                      title={
                        canRemoveIdentity
                          ? undefined
                          : "Connect another provider before removing this identity"
                      }
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyProvider !== null || isLoading}
                      onClick={() => void link(provider)}
                    >
                      {busyProvider === provider ? "Opening…" : "Connect"}
                    </Button>
                  )}
                </div>
              );
            })}

            {isLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading sign-in methods…
              </p>
            ) : null}
            {!isLoading && identities.length < 2 ? (
              <p className="text-xs text-muted-foreground">
                You can't remove your only sign-in method.
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        }
      />

      <AlertDialog
        open={unlinkProvider !== null}
        onOpenChange={(open) => {
          if (!open && busyProvider === null) setUnlinkProvider(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove{" "}
              {unlinkProvider ? PROVIDER_LABEL[unlinkProvider] : "provider"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to use this provider to sign in. Your
              Student account, email and password, subscription, and progress
              are not removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyProvider !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busyProvider !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void unlink();
              }}
            >
              {busyProvider ? "Removing…" : "Remove sign-in method"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
