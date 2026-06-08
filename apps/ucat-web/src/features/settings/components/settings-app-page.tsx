"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@altitutor/ui";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { UCAT_TOUR_REPLAY_OPTIONS, useOnboardingTour } from "@/features/onboarding";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { formatTimeZoneWithGmtOffset } from "@/lib/supported-timezones";
import { cn } from "@/lib/utils";
import { SettingsRow } from "@/features/settings/components/settings-row";

const THEME_OPTIONS = [
  { id: "light" as const, label: "Light" },
  { id: "dark" as const, label: "Dark" },
  { id: "auto" as const, label: "Auto (device)" },
] as const;

type ThemeOption = (typeof THEME_OPTIONS)[number];

const TOUR_REPLAY_ITEMS = [...UCAT_TOUR_REPLAY_OPTIONS];
type TourReplayOption = (typeof UCAT_TOUR_REPLAY_OPTIONS)[number];

const SELECT_TRIGGER =
  "h-10 w-full justify-between font-normal sm:w-auto sm:min-w-[14rem] sm:max-w-md";
const SELECT_CONTENT_WIDTH = "min(100vw - 2rem, 22rem)";

export function SettingsAppPage() {
  const [timezone, setTimezone] = useState<string>("Australia/Adelaide");
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { replayTour, isResetting } = useOnboardingTour();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeChoice = theme === "light" || theme === "dark" ? theme : "auto";

  const selectedThemeOption = useMemo((): ThemeOption | null => {
    if (!mounted) return null;
    return THEME_OPTIONS.find((o) => o.id === themeChoice) ?? THEME_OPTIONS[2];
  }, [mounted, themeChoice]);

  const isDirty = savedTimezone !== null && timezone !== savedTimezone;

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
          title="App settings"
          description="Timezone, theme, and tours"
          backHref="/settings"
          backLabel="All settings"
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
        title="App settings"
        description="Timezone, theme, and tours"
        backHref="/settings"
        backLabel="All settings"
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
                triggerClassName={SELECT_TRIGGER}
                contentWidth={SELECT_CONTENT_WIDTH}
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
          title="Theme"
          description="Choose light, dark, or match your device."
          control={
            mounted ? (
              <SearchableSelect<ThemeOption>
                items={[...THEME_OPTIONS]}
                value={selectedThemeOption}
                onValueChange={(opt) => {
                  if (!opt) return;
                  setTheme(opt.id === "auto" ? "system" : opt.id);
                }}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.id}
                placeholder="Select theme"
                searchPlaceholder="Search themes…"
                emptyMessage="No matching theme."
                triggerClassName={SELECT_TRIGGER}
                contentWidth={SELECT_CONTENT_WIDTH}
              />
            ) : (
              <p className="text-sm text-muted-foreground sm:text-right">Loading…</p>
            )
          }
        />
      </div>

      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
        <SettingsRow
          title="App tours"
          description={
            <>
              Replay a guided walkthrough for a specific area. We reset only that tour, then take
              you to the right page to play it.
              {isMobile ? " Tours are available on desktop-width layouts." : ""}
            </>
          }
          control={
            <div className="w-full sm:w-auto sm:min-w-[14rem] sm:max-w-md">
              <SearchableSelect<TourReplayOption>
                items={TOUR_REPLAY_ITEMS}
                value={null}
                onValueChange={(opt) => {
                  if (!opt) return;
                  void replayTour(opt.tourId, opt.href);
                }}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.tourId}
                getItemValue={(item) => `${item.label} ${item.href}`}
                placeholder="Replay app tour"
                searchPlaceholder="Search tours…"
                emptyMessage="No matching tour."
                disabled={isMobile || isResetting}
                triggerClassName={SELECT_TRIGGER}
                contentWidth={SELECT_CONTENT_WIDTH}
              />
            </div>
          }
        />
      </div>

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
