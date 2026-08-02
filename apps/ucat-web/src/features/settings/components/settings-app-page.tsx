"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SearchableSelect, Switch, useToast } from "@altitutor/ui";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import type {
  ExamToolbarLayout,
  InterfaceTheme,
  UcatInterfacePreferences,
} from "@/features/interface-preferences/model/types";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { UCAT_PROFILE_QUERY_KEY } from "@/features/layout/hooks/use-ucat-profile";
import {
  UCAT_TOUR_REPLAY_OPTIONS,
  useOnboardingTour,
} from "@/features/onboarding";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { formatTimeZoneWithGmtOffset } from "@/lib/supported-timezones";
import { cn } from "@/lib/utils";
import { SettingsRow } from "@/features/settings/components/settings-row";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard";
import { motion } from "motion/react";

const THEME_OPTIONS = [
  { id: "light" as const, label: "Light" },
  { id: "dark" as const, label: "Dark" },
  { id: "system" as const, label: "Auto (device)" },
] as const;

type ThemeOption = (typeof THEME_OPTIONS)[number];

const TOOLBAR_LAYOUT_OPTIONS = [
  { id: "compact_top" as const, label: "Compact top" },
  { id: "detailed_right" as const, label: "Detailed right" },
] as const;

type ToolbarLayoutOption = (typeof TOOLBAR_LAYOUT_OPTIONS)[number];

const TOUR_REPLAY_ITEMS = [...UCAT_TOUR_REPLAY_OPTIONS];
type TourReplayOption = (typeof UCAT_TOUR_REPLAY_OPTIONS)[number];

const SELECT_TRIGGER =
  "h-10 w-full justify-between font-normal sm:w-auto sm:min-w-[14rem] sm:max-w-md";
const SELECT_CONTENT_WIDTH = "min(100vw - 2rem, 22rem)";

const SETTINGS_LEAVE_MESSAGE =
  "You have unsaved settings. Leave this page without saving?";

export function SettingsAppPage() {
  const queryClient = useQueryClient();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [timezone, setTimezone] = useState<string>("Australia/Adelaide");
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { replayTour, isResetting } = useOnboardingTour();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { setTheme } = useTheme();
  const { toast } = useToast();
  const {
    preferences,
    updatePreferences,
    isLoading: preferencesLoading,
  } = useUcatInterfacePreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedThemeOption = useMemo((): ThemeOption | null => {
    if (!mounted) return null;
    return (
      THEME_OPTIONS.find((option) => option.id === preferences.theme) ??
      THEME_OPTIONS[2]
    );
  }, [mounted, preferences.theme]);

  const selectedToolbarLayout = useMemo(
    (): ToolbarLayoutOption =>
      TOOLBAR_LAYOUT_OPTIONS.find(
        (option) => option.id === preferences.examToolbarLayout,
      ) ?? TOOLBAR_LAYOUT_OPTIONS[0],
    [preferences.examToolbarLayout],
  );

  const updateInterfacePreference = async (
    patch: Partial<UcatInterfacePreferences>,
  ) => {
    try {
      await updatePreferences(patch);
    } catch (cause) {
      toast({
        title: "Setting not saved",
        description:
          cause instanceof Error
            ? cause.message
            : "Please try changing the setting again.",
        variant: "destructive",
      });
    }
  };

  const isDirty = savedTimezone !== null && timezone !== savedTimezone;
  useLeaveGuard(isDirty, SETTINGS_LEAVE_MESSAGE);

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
        setOptions(
          list.includes(tz)
            ? list
            : [...list, tz].sort((a, b) => a.localeCompare(b)),
        );
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: UCAT_PROFILE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
        queryClient.invalidateQueries({ queryKey: ["ucat", "activity"] }),
        queryClient.invalidateQueries({
          queryKey: ["ucat-practice-discount-dashboard"],
        }),
      ]);
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
    return <AppPageSkeleton variant="detail" />;
  }

  return (
    <motion.div
      className={cn(
        "space-y-6",
        isDirty &&
          "pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]",
      )}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="App settings"
          description="Timezone, appearance, interface, and tours"
          backHref="/settings"
          backLabel="All settings"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
          "hover:shadow-md",
        )}
      >
        <SettingsRow
          title="Timezone"
          description="Used for practice day discounts (e.g. 10 questions per day)."
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
                <p className="text-left text-sm text-destructive sm:text-right">
                  {error}
                </p>
              ) : null}
            </div>
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
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
                  const nextTheme: InterfaceTheme = opt.id;
                  setTheme(nextTheme);
                  void updateInterfacePreference({ theme: nextTheme });
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
              <p className="text-sm text-muted-foreground sm:text-right">
                Loading…
              </p>
            )
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="divide-y divide-border/60">
          <SettingsRow
            title="Exam toolbar layout"
            description="Keep the toolbar compact above the exam, or show details beside it. Mobile always uses the compact top layout."
            control={
              <SearchableSelect<ToolbarLayoutOption>
                items={[...TOOLBAR_LAYOUT_OPTIONS]}
                value={selectedToolbarLayout}
                onValueChange={(option) => {
                  if (!option) return;
                  void updateInterfacePreference({
                    examToolbarLayout: option.id as ExamToolbarLayout,
                  });
                }}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.id}
                placeholder="Select toolbar layout"
                searchPlaceholder="Search layouts…"
                emptyMessage="No matching layout."
                disabled={preferencesLoading || isMobile}
                triggerClassName={SELECT_TRIGGER}
                contentWidth={SELECT_CONTENT_WIDTH}
              />
            }
          />
          <SettingsRow
            title="Show exam toolbar"
            description="Show the supporting toolbar around the UCAT question engine."
            control={
              <Switch
                checked={preferences.examToolbarVisible}
                disabled={preferencesLoading}
                onCheckedChange={(checked) => {
                  void updateInterfacePreference({
                    examToolbarVisible: checked,
                  });
                }}
                aria-label="Show exam toolbar"
              />
            }
          />
          <SettingsRow
            title="Lag mode"
            description="Add a short delay between question engine actions to simulate exam-centre computers."
            control={
              <Switch
                checked={preferences.lagModeEnabled}
                disabled={preferencesLoading}
                onCheckedChange={(checked) => {
                  void updateInterfacePreference({ lagModeEnabled: checked });
                }}
                aria-label="Enable lag mode"
              />
            }
          />
          <SettingsRow
            title="Study suggestions"
            description="Show personalised study suggestions throughout the app."
            control={
              <Switch
                checked={preferences.studySuggestionsVisible}
                disabled={preferencesLoading}
                onCheckedChange={(checked) => {
                  void updateInterfacePreference({
                    studySuggestionsVisible: checked,
                  });
                }}
                aria-label="Show study suggestions"
              />
            }
          />
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="App tours"
          description={
            <>
              Replay a guided walkthrough for a specific area. We reset only
              that tour, then take you to the right page to play it.
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
      </motion.div>

      <AppShellBottomFloatingDock visible={isDirty}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelEdits}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </AppShellBottomFloatingDock>
    </motion.div>
  );
}
