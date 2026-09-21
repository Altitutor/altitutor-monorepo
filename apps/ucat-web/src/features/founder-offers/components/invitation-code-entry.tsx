"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeUcatInvitationCode } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { captureUcatEvent } from "@/lib/analytics/posthog";
import {
  pendingInvitation,
  rememberInvitation,
} from "../lib/pending-invitation";

type Invitation = {
  id?: string;
  code: string;
  campaign?: string;
  kind: "access_pass" | "discount" | "referral";
  name: string;
  description: string;
  terms: string;
};

export function InvitationCodeEntry({
  initialCode,
  appearance = "card",
  presentation = "entry",
  onDeclined,
  onOfferLoaded,
  onCodeApplied,
  disabled = false,
}: {
  initialCode?: string;
  appearance?: "card" | "plain";
  presentation?: "entry" | "gift";
  onDeclined?: () => void;
  onOfferLoaded?: (available: boolean) => void;
  onCodeApplied?: (code: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const inputId = useId();
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [offer, setOffer] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(Boolean(initialCode));
  const [applied, setApplied] = useState(false);

  const preview = useCallback(
    async (value: string) => {
      const normalized = normalizeUcatInvitationCode(value);
      if (!normalized)
        throw new Error("Enter a valid invitation or referral code.");
      const response = await fetch(
        `/api/ucat/invitations?code=${encodeURIComponent(normalized)}`,
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Could not load invitation.");
      const invitation = body as Invitation;
      setCode(normalized);
      setOffer(invitation);
      onOfferLoaded?.(true);
      captureUcatEvent("invitation_previewed", {
        offer_id: invitation.id ?? null,
        offer_code: normalized,
        offer_kind: invitation.kind,
        offer_campaign: invitation.campaign ?? null,
      });
      return invitation;
    },
    [onOfferLoaded],
  );

  useEffect(() => {
    const saved = initialCode ?? pendingInvitation();
    if (!saved) return;
    setCode(saved);
    setOpen(true);
    if (presentation !== "gift") return;
    setBusy(true);
    void preview(saved)
      .catch((reason: unknown) => {
        onOfferLoaded?.(false);
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load invitation.",
        );
      })
      .finally(() => setBusy(false));
  }, [initialCode, presentation, preview, onOfferLoaded]);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const invitation = offer ?? (await preview(code));
      if (onCodeApplied) await onCodeApplied(invitation.code);
      else
        router.push(`/subscribe?offer=${encodeURIComponent(invitation.code)}`);
      rememberInvitation(invitation.code);
      setApplied(true);
      if (invitation.kind === "discount")
        captureUcatEvent("founder_discount_selected", {
          offer_id: invitation.id,
          offer_code: invitation.code,
          offer_campaign: invitation.campaign,
          offer_kind: invitation.kind,
        });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not apply this code.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={
        appearance === "plain"
          ? "text-foreground"
          : "rounded-xl border border-border bg-card p-4 text-card-foreground"
      }
    >
      {presentation === "entry" && (
        <button
          type="button"
          className="text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Have an invitation or referral code?
        </button>
      )}
      {(open || presentation === "gift") && (
        <div className="mt-3 space-y-3">
          {presentation === "entry" ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void apply();
              }}
            >
              <label className="sr-only" htmlFor={inputId}>
                Invitation or referral code
              </label>
              <input
                id={inputId}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
                value={code}
                maxLength={42}
                onChange={(event) => {
                  setCode(event.target.value);
                  setOffer(null);
                  setApplied(false);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                disabled={busy || disabled}
              />
              <Button
                variant="outline"
                type="submit"
                disabled={busy || disabled || !code.trim()}
              >
                {busy ? "Applying…" : "Check code"}
              </Button>
            </form>
          ) : offer ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">{offer.name}</p>
              <p>{offer.description}</p>
              <p className="text-muted-foreground">{offer.terms}</p>
              <Button
                type="button"
                disabled={busy || disabled}
                onClick={() => void apply()}
              >
                Accept gift and choose a plan
              </Button>
            </div>
          ) : null}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {applied && presentation === "entry" && (
            <p role="status" className="text-sm">
              Code selected. Your offer will be confirmed at checkout.
            </p>
          )}
          {presentation === "gift" && (
            <Button
              variant="outline"
              disabled={busy || disabled}
              onClick={() => {
                rememberInvitation(null);
                onDeclined?.();
              }}
            >
              Continue with Free
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
