"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeUcatInvitationCode } from "@altitutor/shared";
import { useAuth } from "@/features/auth";
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
  percentOff?: number;
};

export function InvitationCodeEntry({
  initialCode,
  onDiscountApplied,
  onPassRedeemed,
  beforeApply,
}: {
  initialCode?: string;
  onDiscountApplied?: (code: string, percentOff: number) => void;
  onPassRedeemed?: () => void;
  beforeApply?: () => Promise<void>;
}) {
  const inputId = useId();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(initialCode ?? "");
  const [offer, setOffer] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(Boolean(initialCode));

  async function preview(value: string) {
    const normalized = normalizeUcatInvitationCode(value);
    if (!normalized) {
      setError("Enter a valid invitation or referral code.");
      return;
    }
    setBusy(true);
    setError(null);
    setOffer(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/ucat/invitations?code=${encodeURIComponent(normalized)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load invitation.");
      setCode(normalized);
      setOffer(body as Invitation);
      captureUcatEvent("invitation_previewed", {
        offer_id: body.id ?? null,
        offer_code: normalized,
        offer_kind: body.kind,
        offer_campaign: body.campaign ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invitation.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const saved = initialCode ?? pendingInvitation();
    if (saved) {
      setCode(saved);
      setOpen(true);
      rememberInvitation(saved);
      void preview(saved);
    }
  }, [initialCode]);

  async function accept() {
    if (!offer) return;
    if (!user) {
      rememberInvitation(offer.code);
      router.push(
        `/signup?redirect=${encodeURIComponent(`/invite/${offer.code}`)}`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await beforeApply?.();
      if (offer.kind === "discount") {
        rememberInvitation(offer.code);
        captureUcatEvent("founder_discount_selected", {
          offer_id: offer.id,
          offer_code: offer.code,
          offer_campaign: offer.campaign,
          offer_kind: offer.kind,
        });
        if (onDiscountApplied) {
          onDiscountApplied(offer.code, offer.percentOff ?? 0);
          setNotice(
            "Discount selected. Your final price will be confirmed at checkout.",
          );
        } else router.push("/subscribe");
        return;
      }
      const res = await fetch("/api/ucat/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: offer.code }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? "Could not redeem invitation.");
      rememberInvitation(null);
      if (body.kind === "referral") {
        window.location.assign(
          `/checkout?tier=unlimited&interval=${body.interval}&context=referral_gift&gift=${body.giftId}`,
        );
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["ucat-access"] }),
          queryClient.invalidateQueries({ queryKey: ["founder-access"] }),
        ]);
        setOffer(null);
        setNotice(
          `Your free Unlimited access ends ${new Date(body.accessEndsAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. You will not be charged automatically.`,
        );
        onPassRedeemed?.();
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <button
        type="button"
        className="text-sm font-medium underline-offset-4 hover:underline"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Have an invitation or referral code?
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void preview(code);
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
              onChange={(e) => {
                setCode(e.target.value);
                setOffer(null);
              }}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <Button
              variant="outline"
              type="submit"
              disabled={busy || !code.trim()}
            >
              Check code
            </Button>
          </form>
          {offer && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{offer.name}</p>
              <p>{offer.description}</p>
              <p className="text-muted-foreground">{offer.terms}</p>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void accept()}
              >
                {busy
                  ? "Please wait…"
                  : !user
                    ? "Sign up to claim"
                    : offer.kind === "access_pass"
                      ? "Start free access"
                      : offer.kind === "discount"
                        ? "Use this discount"
                        : "Accept gift and continue to checkout"}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {notice && !onPassRedeemed && (
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Continue to practice
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
