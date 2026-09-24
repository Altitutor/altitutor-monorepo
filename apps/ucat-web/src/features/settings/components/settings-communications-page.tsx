"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Switch, useToast } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SettingsRow } from "@/features/settings/components/settings-row";
import {
  DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  type UcatCommunicationPreferences,
  type UcatCommunicationTopic,
} from "@/features/communications/lib/communication-preferences";
import {
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const OPTIONS: Array<{
  key: UcatCommunicationTopic;
  title: string;
  description: string;
}> = [
  {
    key: "weekly_progress_and_guidance",
    title: "Weekly progress and study guidance",
    description:
      "A useful summary of your work and one clear next step, once there is enough practice.",
  },
  {
    key: "lessons_and_tips",
    title: "UCAT lessons and preparation tips",
    description:
      "Optional explanations, tutorials and preparation advice from Altitutor.",
  },
  {
    key: "product_news",
    title: "Product news",
    description:
      "Important new Altitutor UCAT features and improvements.",
  },
  {
    key: "offers_and_referrals",
    title: "Offers and referral campaigns",
    description:
      "Occasional access grants, promotions and ways to help a friend start preparing.",
  },
];

const SETTINGS_LEAVE_MESSAGE =
  "You have unsaved settings. Leave this page without saving?";

export function SettingsCommunicationsPage() {
  const { toast } = useToast();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [preferences, setPreferences] = useState<UcatCommunicationPreferences>(
    DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  );
  const [saved, setSaved] = useState<UcatCommunicationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/ucat/communications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load email preferences.");
        return response.json() as Promise<{
          preferences: UcatCommunicationPreferences;
        }>;
      })
      .then(({ preferences: next }) => {
        setPreferences(next);
        setSaved(next);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load email preferences.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    saved !== null &&
    OPTIONS.some(({ key }) => preferences[key] !== saved[key]);
  useLeaveGuard(isDirty, SETTINGS_LEAVE_MESSAGE);

  const handleCancel = () => {
    if (saved) setPreferences(saved);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/ucat/communications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (!response.ok) throw new Error("Could not save email preferences.");
      setSaved(preferences);
    } catch (error) {
      toast({
        title: "Could not save",
        description:
          error instanceof Error
            ? error.message
            : "Could not save email preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppPageSkeleton variant="detail" />;

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
          title="Email preferences"
          description="Choose the optional emails that are useful to you."
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
        )}
      >
        {OPTIONS.map((option) => (
          <SettingsRow
            key={option.key}
            title={option.title}
            description={option.description}
            control={
              <Switch
                checked={preferences[option.key]}
                onCheckedChange={(checked) => {
                  setPreferences((current) => ({
                    ...current,
                    [option.key]: checked,
                  }));
                }}
                aria-label={option.title}
              />
            }
          />
        ))}
        {loadError ? (
          <p className="pt-2 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
      </motion.div>

      <motion.p
        variants={itemVariants}
        className="text-sm leading-6 text-muted-foreground"
      >
        Account, security, billing and access emails are not affected because
        they are needed to provide your account.
      </motion.p>

      <AppShellBottomFloatingDock visible={isDirty}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </AppShellBottomFloatingDock>
    </motion.div>
  );
}
