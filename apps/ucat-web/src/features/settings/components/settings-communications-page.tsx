"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SettingsRow } from "@/features/settings/components/settings-row";
import {
  DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  type UcatCommunicationPreferences,
  type UcatCommunicationTopic,
} from "@/features/communications/lib/communication-preferences";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  key: UcatCommunicationTopic;
  title: string;
  description: string;
}> = [
  {
    key: "weekly_progress_and_guidance",
    title: "Weekly progress and study guidance",
    description: "A useful summary of your work and one clear next step, once there is enough evidence.",
  },
  {
    key: "lessons_and_tips",
    title: "UCAT lessons and preparation tips",
    description: "Optional explanations, tutorials and preparation advice from Altitutor.",
  },
  {
    key: "product_news",
    title: "Product news",
    description: "Important new Altitutor UCAT features and improvements.",
  },
  {
    key: "offers_and_referrals",
    title: "Offers and referral campaigns",
    description: "Occasional access grants, promotions and ways to help a friend start preparing.",
  },
];

export function SettingsCommunicationsPage() {
  const [preferences, setPreferences] = useState<UcatCommunicationPreferences>(
    DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  );
  const [saved, setSaved] = useState<UcatCommunicationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/ucat/communications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load email preferences.");
        return response.json() as Promise<{ preferences: UcatCommunicationPreferences }>;
      })
      .then(({ preferences: next }) => {
        setPreferences(next);
        setSaved(next);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not load email preferences.");
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty = saved !== null && OPTIONS.some(({ key }) => preferences[key] !== saved[key]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ucat/communications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (!response.ok) throw new Error("Could not save email preferences.");
      setSaved(preferences);
      setMessage("Email preferences saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save email preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppPageSkeleton variant="detail" />;

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <UcatPageHeader
        title="Email preferences"
        description="Choose the optional emails that are useful to you."
        backHref="/settings"
        backLabel="All settings"
      />
      <div className={cn("rounded-ucatShell p-6 sm:p-8", UCAT_SURFACE_CARD)}>
        {OPTIONS.map((option) => (
          <SettingsRow
            key={option.key}
            title={option.title}
            description={option.description}
            control={
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences[option.key]}
                  onChange={(event) => {
                    setPreferences((current) => ({
                      ...current,
                      [option.key]: event.target.checked,
                    }));
                    setMessage(null);
                  }}
                  className="h-5 w-5 rounded border-border accent-primary"
                />
                {preferences[option.key] ? "On" : "Off"}
              </label>
            }
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {message ? <p className="mr-auto text-sm text-muted-foreground" role="status">{message}</p> : null}
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || saving}
          onClick={() => {
            if (saved) setPreferences(saved);
            setMessage(null);
          }}
        >
          Cancel
        </Button>
        <Button type="button" disabled={!isDirty || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Account, security, billing and access emails are not affected because they are needed to provide your account.
      </p>
    </motion.div>
  );
}
