"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label } from "@altitutor/ui";
import { ucatFounderOfferDescription } from "@altitutor/shared";
import {
  createFounderOffer,
  listFounderOffers,
  setFounderOfferActive,
  type FounderOffer,
} from "../api/founder-offers";

export function FounderOffers() {
  const [offers, setOffers] = useState<FounderOffer[]>([]);
  const [kind, setKind] = useState("access_pass");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setOffers(await listFounderOffers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load offers.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await createFounderOffer({
        code: data.get("code"),
        name: data.get("name"),
        campaign: data.get("campaign"),
        kind,
        duration_count: Number(data.get("duration_count")),
        duration_unit: data.get("duration_unit"),
        percent_off: Number(data.get("percent_off")),
        max_redemptions: data.get("max_redemptions")
          ? Number(data.get("max_redemptions"))
          : null,
        expires_at: data.get("expires_at")
          ? new Date(String(data.get("expires_at"))).toISOString()
          : null,
      });
      form.reset();
      setNotice("Offer created. Copy its invitation link below.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create offer.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(offer: FounderOffer) {
    setBusy(true);
    setError(null);
    try {
      await setFounderOfferActive(offer.id, !offer.active);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update offer.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(offer: FounderOffer) {
    const url = new URL(
      `/invite/${offer.code}`,
      process.env.NEXT_PUBLIC_UCAT_WEB_URL || "https://ucat.altitutor.com",
    );
    url.searchParams.set("utm_source", "founder");
    url.searchParams.set("utm_medium", "invitation");
    url.searchParams.set("utm_campaign", offer.campaign);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Invitation link copied.");
    } catch {
      setError("Could not copy the link. Check clipboard permissions.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Founder offers</h2>
        <p className="text-sm text-muted-foreground">
          Issue free access passes or recurring discounts for new subscriptions.
          Offer terms are fixed once created; disable a code to stop new claims.
        </p>
      </div>
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
      <form
        onSubmit={save}
        className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="offer-name">Offer name</Label>
          <Input
            id="offer-name"
            name="name"
            required
            maxLength={100}
            placeholder="Founding students"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="offer-campaign">Campaign</Label>
          <Input
            id="offer-campaign"
            name="campaign"
            required
            maxLength={100}
            placeholder="founders-2026"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="offer-code">Code</Label>
          <Input
            id="offer-code"
            name="code"
            required
            pattern="[Ff]-[A-Za-z0-9-]{3,40}"
            placeholder="F-FOUNDERS"
          />
          <p className="text-xs text-muted-foreground">
            Start with F-. Use a different code for each person or distribution
            source.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="offer-kind">Benefit</Label>
          <select
            id="offer-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3"
          >
            <option value="access_pass">Free Unlimited access</option>
            <option value="discount">Recurring percentage discount</option>
          </select>
        </div>
        {kind === "access_pass" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="offer-duration">Free duration</Label>
              <Input
                id="offer-duration"
                name="duration_count"
                type="number"
                min={1}
                max={24}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="offer-unit">Duration unit</Label>
              <select
                id="offer-unit"
                name="duration_unit"
                className="h-10 w-full rounded-md border bg-background px-3"
              >
                <option value="week">Weeks</option>
                <option value="month">Calendar months</option>
              </select>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="offer-percent">Discount (%)</Label>
            <Input
              id="offer-percent"
              name="percent_off"
              type="number"
              min={1}
              max={100}
              defaultValue={20}
              required
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="offer-limit">Maximum uses (blank = unlimited)</Label>
          <Input
            id="offer-limit"
            name="max_redemptions"
            type="number"
            min={1}
            step={1}
            placeholder="1 for a personal gift"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="offer-expiry">
            Redeem by (optional, your local time)
          </Label>
          <Input id="offer-expiry" name="expires_at" type="datetime-local" />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Free passes need no card and never renew automatically. Discounts
          apply to weekly, monthly or yearly Unlimited at checkout and end with
          the subscription. Earned practice and referral rewards remain
          available.
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create offer"}
        </Button>
      </form>
      {loading ? (
        <p role="status">Loading offers…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Founder offers and redemption totals
            </caption>
            <thead>
              <tr className="border-b">
                {["Offer", "Benefit", "Usage", "Availability", "Actions"].map(
                  (label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => {
                const used = offer.ucat_founder_redemptions.filter(
                  (r) => r.status === "redeemed",
                ).length;
                const pending = offer.ucat_founder_redemptions.filter(
                  (r) => r.status === "reserved",
                ).length;
                const expired =
                  offer.expires_at &&
                  Date.parse(offer.expires_at) <= Date.now();
                return (
                  <tr key={offer.id} className="border-b align-top">
                    <td className="p-3">
                      <strong>{offer.name}</strong>
                      <p className="font-mono">{offer.code}</p>
                      <p className="text-muted-foreground">{offer.campaign}</p>
                    </td>
                    <td className="p-3">
                      {ucatFounderOfferDescription(offer)}
                    </td>
                    <td className="p-3">
                      {used} / {offer.max_redemptions ?? "Unlimited"} redeemed
                      {pending > 0 && <p>{pending} checkout reservation(s)</p>}
                      {used > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer">
                            View redemptions
                          </summary>
                          <ul className="space-y-1 pt-2">
                            {offer.ucat_founder_redemptions
                              .filter((r) => r.status === "redeemed")
                              .map((r) => (
                                <li key={r.id}>
                                  <a
                                    className="underline"
                                    href={`/students/${r.student_id}`}
                                  >
                                    Student {r.student_id.slice(0, 8)}
                                  </a>{" "}
                                  ·{" "}
                                  {r.redeemed_at
                                    ? new Date(
                                        r.redeemed_at,
                                      ).toLocaleDateString()
                                    : ""}
                                </li>
                              ))}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td className="p-3">
                      {!offer.active
                        ? "Disabled"
                        : expired
                          ? "Expired"
                          : offer.max_redemptions !== null &&
                              used + pending >= offer.max_redemptions
                            ? "Fully claimed"
                            : "Available"}
                      {offer.expires_at && (
                        <p className="text-xs">
                          Until {new Date(offer.expires_at).toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="space-x-2 p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyLink(offer)}
                      >
                        Copy link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void toggle(offer)}
                      >
                        {offer.active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {offers.length === 0 && (
            <p className="p-3 text-muted-foreground">No founder offers yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
