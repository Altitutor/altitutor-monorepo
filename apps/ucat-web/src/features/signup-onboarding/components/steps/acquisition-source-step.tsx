"use client";

import React, { useState } from "react";
import {
  MARKETING_TOKENS,
  type UcatAcquisitionSource,
} from "@altitutor/shared";
import { Check } from "lucide-react";
import { UCAT_SIGNUP_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const SOURCE_OPTIONS: Array<{
  value: UcatAcquisitionSource;
  label: string;
}> = [
  { value: "reddit", label: "Reddit" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "search", label: "Google or another search engine" },
  { value: "friend_or_classmate", label: "Friend or classmate" },
  { value: "altitutor_tutor", label: "Altitutor tutor" },
  { value: "school_or_teacher", label: "School or teacher" },
  { value: "business_card_or_flyer", label: "Business card or flyer" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "I’m not sure / prefer not to say" },
];

type AcquisitionSourceStepProps = {
  selectedSources: UcatAcquisitionSource[];
  otherSource: string;
  onSelectedSourcesChange: (sources: UcatAcquisitionSource[]) => void;
  onOtherSourceChange: (value: string) => void;
  onComplete: () => Promise<void>;
  error: string | null;
  setError: (value: string | null) => void;
};

export function SignupCompleteAcquisitionSourceStep({
  selectedSources,
  otherSource,
  onSelectedSourcesChange,
  onOtherSourceChange,
  onComplete,
  error,
  setError,
}: AcquisitionSourceStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleSource(source: UcatAcquisitionSource) {
    setError(null);
    if (source === "not_sure") {
      onSelectedSourcesChange(
        selectedSources.includes("not_sure") ? [] : ["not_sure"],
      );
      return;
    }

    const withoutUncertainty = selectedSources.filter(
      (value) => value !== "not_sure",
    );
    onSelectedSourcesChange(
      withoutUncertainty.includes(source)
        ? withoutUncertainty.filter((value) => value !== source)
        : [...withoutUncertainty, source],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (selectedSources.length === 0) {
      setError("Select at least one option to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t save your answer. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl bg-card/80 p-6 shadow-sm ring-1 ring-border backdrop-blur-sm sm:p-8"
    >
      <fieldset disabled={isSubmitting} className="space-y-3">
        <legend className="sr-only">How you heard about Altitutor UCAT</legend>
        <p className={`text-sm text-muted-foreground ${typo.secondarySans}`}>
          Select all that apply.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCE_OPTIONS.map((option) => {
            const selected = selectedSources.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-primary/30 dark:focus-within:ring-accent/30",
                  selected
                    ? "border-primary/60 bg-primary/10 dark:border-accent/60 dark:bg-accent/10"
                    : "border-border bg-background/60 hover:border-primary/30 hover:bg-muted/60",
                  isSubmitting && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={selected}
                  onChange={() => toggleSource(option.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground dark:border-accent dark:bg-accent"
                      : "border-border bg-background",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span
                  className={`text-sm font-medium text-foreground ${typo.secondarySans}`}
                >
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {selectedSources.includes("other") ? (
        <div className="space-y-1.5">
          <label
            htmlFor="acquisition-other"
            className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
          >
            Anything else?{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="acquisition-other"
            value={otherSource}
            onChange={(event) => onOtherSourceChange(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            placeholder="Tell us where you first came across Altitutor UCAT"
            className={`w-full resize-none rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20 ${typo.secondarySans}`}
          />
        </div>
      ) : null}

      {error ? (
        <p
          className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(UCAT_SIGNUP_PRIMARY_ACTION, typo.headingSans)}
      >
        {isSubmitting ? "Saving…" : "Next"}
      </button>
    </form>
  );
}
