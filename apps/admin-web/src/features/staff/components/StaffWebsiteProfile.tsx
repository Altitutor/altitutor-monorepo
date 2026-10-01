"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@altitutor/ui";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export function StaffWebsiteProfile({
  staffId,
  active,
}: {
  staffId: string;
  active: boolean;
}) {
  const [published, setPublished] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage("");
    setFailed(false);
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from("staff_marketing_profiles")
          .select("*")
          .eq("staff_id", staffId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setFailed(true);
          setMessage("Could not load website settings.");
        } else {
          setPublished(data?.published ?? false);
          setName(data?.display_name ?? "");
          setTitle(data?.public_title ?? "");
          setOrder(data?.display_order ?? 1000);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setMessage("Could not load website settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await getSupabaseClient()
        .from("staff_marketing_profiles")
        .upsert({
          staff_id: staffId,
          published,
          display_name: name.trim() || null,
          public_title: title.trim(),
          display_order: order,
        });
      if (error) throw error;
      setMessage(
        "Saved. Changes appear after the next daily refresh, or select Refresh website.",
      );
    } catch {
      setMessage("Could not save website settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/website-refresh", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Refresh failed");
      setMessage(
        "Refresh requested. The about page will regenerate on its next visit.",
      );
    } catch {
      setMessage(
        "Refresh failed. Saved changes remain saved and will appear after the next automatic refresh.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading website profile…</p>;
  return (
    <div className="space-y-5 p-6">
      <h3 className="text-lg font-semibold">Public website profile</h3>
      <p className="text-sm text-muted-foreground">
        Staff edit their bio and photo in their own profile. These settings
        control their appearance on the about page.
      </p>
      {!active && (
        <p className="text-sm">
          This staff member is not active and will not appear on the website.
        </p>
      )}
      <fieldset disabled={busy || failed} className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />
          Show on website
        </label>
        <div>
          <Label htmlFor={`website-name-${staffId}`}>
            Display name (optional)
          </Label>
          <Input
            id={`website-name-${staffId}`}
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Use staff name"
          />
        </div>
        <div>
          <Label htmlFor={`website-title-${staffId}`}>
            Public title and subjects
          </Label>
          <Input
            id={`website-title-${staffId}`}
            maxLength={500}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`website-order-${staffId}`}>
            Display order (lowest first)
          </Label>
          <Input
            id={`website-order-${staffId}`}
            type="number"
            min={0}
            max={2147483647}
            step={1}
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
          />
        </div>
        <Button
          onClick={() => void save()}
          disabled={!Number.isInteger(order) || order < 0 || order > 2147483647}
        >
          Save website settings
        </Button>
      </fieldset>
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
        Refresh website
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
