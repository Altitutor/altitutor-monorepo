"use client";

import { useState, useEffect } from "react";
import { Button, Label } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useOnboardingTour } from "@/features/onboarding";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { UCAT_INTERACTION_EASE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [timezone, setTimezone] = useState<string>("Australia/Adelaide");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { restartTour, resetAllTours } = useOnboardingTour();
  // Sidebar (which the welcome tour highlights) is hidden behind a hamburger
  // on mobile, so the welcome tour is desktop-only.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [tourFeedback, setTourFeedback] = useState<string | null>(null);

  const handleResetAllTours = () => {
    resetAllTours();
    setTourFeedback(
      "Feature tours reset. They will show again next time you visit each section.",
    );
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ucat/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = (await res.json()) as {
          timezone?: string;
          timezoneOptions?: string[];
        };
        setTimezone(data.timezone ?? "Australia/Adelaide");
        setOptions(data.timezoneOptions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ucat/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Settings"
          description="Manage your account settings"
        />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Settings"
        description="Manage your account settings"
      />

      <div
        className={cn(
          "rounded-lg border border-border bg-card p-6 shadow-sm",
          "transition-shadow duration-200",
          UCAT_INTERACTION_EASE,
          "hover:shadow-md",
        )}
      >
        <h3 className="font-semibold">Timezone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Used for practice day discounts (e.g. 20 questions per day).
        </p>
        <div className="mt-4">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={cn(
              "mt-2 block w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm",
              "transition-[border-color,box-shadow] duration-200",
              UCAT_INTERACTION_EASE,
              "hover:border-ring/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {options.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold">App tours</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Replay the main walkthrough, or reset every per-feature intro so
          each one shows again next time you visit it.
          {isMobile ? " Tours are available on desktop only." : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTourFeedback(null);
              restartTour();
            }}
            disabled={isMobile}
          >
            Replay app tour
          </Button>
          <Button
            variant="ghost"
            onClick={handleResetAllTours}
            disabled={isMobile}
          >
            Reset feature tours
          </Button>
        </div>
        {tourFeedback ? (
          <p className="mt-3 text-sm text-muted-foreground">{tourFeedback}</p>
        ) : null}
      </div>
    </div>
  );
}
