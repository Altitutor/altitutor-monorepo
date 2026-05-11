"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  SearchableSelect,
  buttonVariants,
} from "@altitutor/ui";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { useOnboardingTour } from "@/features/onboarding";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { formatTimeZoneWithGmtOffset } from "@/lib/supported-timezones";
import { cn } from "@/lib/utils";

function SettingsRow({
  title,
  description,
  control,
}: {
  title: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 py-6 last:border-b-0 last:pb-0 first:pt-0",
        "sm:flex-row sm:items-start sm:justify-between sm:gap-8",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="w-full shrink-0 sm:flex sm:max-w-xs sm:justify-end">{control}</div>
    </div>
  );
}

export function SettingsPage() {
  const [timezone, setTimezone] = useState<string>("Australia/Adelaide");
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { restartTour, resetAllTours } = useOnboardingTour();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [tourFeedback, setTourFeedback] = useState<string | null>(null);
  const [resetToursOpen, setResetToursOpen] = useState(false);

  const isDirty = savedTimezone !== null && timezone !== savedTimezone;

  const handleResetAllToursConfirm = () => {
    resetAllTours();
    setResetToursOpen(false);
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
        const tz = data.timezone ?? "Australia/Adelaide";
        const list = data.timezoneOptions ?? [];
        setTimezone(tz);
        setSavedTimezone(tz);
        setOptions(list.includes(tz) ? list : [...list, tz].sort((a, b) => a.localeCompare(b)));
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
      setSavedTimezone(timezone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdits = () => {
    if (savedTimezone !== null) {
      setTimezone(savedTimezone);
    }
    setError(null);
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
    <div
      className={cn(
        "space-y-6",
        isDirty &&
          "pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]",
      )}
    >
      <UcatPageHeader
        title="Settings"
        description="Manage your account settings"
      />

      <div
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
          "hover:shadow-md",
        )}
      >
        <SettingsRow
          title="Timezone"
          description="Used for practice day discounts (e.g. 20 questions per day)."
          control={
            <div className="w-full space-y-2 sm:w-auto sm:min-w-[14rem] sm:max-w-md">
              <SearchableSelect<string>
                items={options}
                value={timezone}
                onValueChange={(next) => {
                  if (next) setTimezone(next);
                }}
                getItemLabel={(item) => formatTimeZoneWithGmtOffset(item)}
                getItemId={(item) => item}
                placeholder="Select timezone"
                searchPlaceholder="Search timezones…"
                emptyMessage="No matching timezone."
                triggerClassName="h-10 w-full justify-between font-normal"
                contentWidth="min(100vw - 2rem, 22rem)"
              />
              {error ? (
                <p className="text-left text-sm text-destructive sm:text-right">{error}</p>
              ) : null}
            </div>
          }
        />
      </div>

      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
        <SettingsRow
          title="App tours"
          description={
            <>
              Replay the main walkthrough, or reset every per-feature intro so each one shows again
              next time you visit it.
              {isMobile ? " Tours are available on desktop only." : ""}
            </>
          }
          control={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setTourFeedback(null);
                  restartTour();
                }}
                disabled={isMobile}
              >
                Replay app tour
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setResetToursOpen(true)}
                disabled={isMobile}
              >
                Reset feature tours
              </Button>
            </div>
          }
        />
        {tourFeedback ? (
          <p className="mt-2 text-sm text-muted-foreground sm:text-right">{tourFeedback}</p>
        ) : null}
      </div>

      <AlertDialog open={resetToursOpen} onOpenChange={setResetToursOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all feature tours?</AlertDialogTitle>
            <AlertDialogDescription>
              Every section intro will show again the next time you open that part of the app. This
              does not affect your saved progress or scores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleResetAllToursConfirm}
            >
              Reset tours
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppShellBottomFloatingDock visible={isDirty}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancelEdits} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </AppShellBottomFloatingDock>
    </div>
  );
}
