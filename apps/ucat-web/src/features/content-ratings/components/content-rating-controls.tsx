"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from "@altitutor/ui";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  UcatContentRatingDescriptor,
  UcatContentRatingReason,
  UcatContentRatingValue,
} from "../types";

const INSIGHT_REASONS: Array<{
  code: UcatContentRatingReason;
  label: string;
}> = [
  { code: "inaccurate", label: "It seems inaccurate" },
  { code: "not_relevant", label: "It isn't relevant to me" },
  { code: "too_generic", label: "It's too generic" },
  { code: "unclear", label: "It's unclear" },
  { code: "timing_advice_wrong", label: "The timing advice feels wrong" },
  { code: "other", label: "Something else" },
];

const EXPLANATION_REASONS: Array<{
  code: UcatContentRatingReason;
  label: string;
}> = [
  { code: "inaccurate", label: "It seems incorrect" },
  { code: "unclear", label: "It's unclear" },
  { code: "skips_steps", label: "It skips important steps" },
  { code: "too_long", label: "It's too long" },
  { code: "not_relevant", label: "It doesn't answer the question" },
  { code: "other", label: "Something else" },
];

const QUESTION_REASONS: Array<{
  code: UcatContentRatingReason;
  label: string;
}> = [
  { code: "misformatted", label: "It's misformatted" },
  { code: "answer_incorrect", label: "The answer seems incorrect" },
  { code: "unclear", label: "The question is unclear" },
  { code: "too_easy", label: "It's too easy" },
  { code: "too_hard", label: "It's too hard" },
  { code: "other", label: "Something else" },
];

type ContentRatingControlsProps = {
  descriptor: UcatContentRatingDescriptor;
  className?: string;
};

function descriptorQuery(descriptor: UcatContentRatingDescriptor): string {
  return new URLSearchParams({
    targetType: descriptor.targetType,
    targetKey: descriptor.targetKey,
    targetVersion: descriptor.targetVersion,
    contextKey: descriptor.contextKey,
    surface: descriptor.surface,
  }).toString();
}

export function ContentRatingControls({
  descriptor,
  className,
}: ContentRatingControlsProps) {
  const [reasonText, setReasonText] = useState("");
  const [selectedReason, setSelectedReason] =
    useState<UcatContentRatingReason | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const identity = `${descriptor.targetType}:${descriptor.targetKey}:${descriptor.targetVersion}:${descriptor.contextKey}`;
  const queryKey = ["ucat-content-rating", identity] as const;
  const queryClient = useQueryClient();
  const ratingQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/ucat/content-ratings?${descriptorQuery(descriptor)}`,
      );
      if (!response.ok) throw new Error("Could not load your rating");
      const payload = (await response.json()) as {
        rating: UcatContentRatingValue | null;
      };
      return payload.rating;
    },
    staleTime: 60_000,
  });
  const saveMutation = useMutation({
    mutationFn: async (nextRating: UcatContentRatingValue) => {
      const response = await fetch("/api/ucat/content-ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor, rating: nextRating }),
      });
      if (!response.ok) throw new Error("Could not save your rating");
      const payload = (await response.json()) as {
        rating: UcatContentRatingValue;
      };
      return payload.rating;
    },
    onMutate: async (nextRating) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UcatContentRatingValue | null>(
        queryKey,
      );
      queryClient.setQueryData(queryKey, nextRating);
      return { previous };
    },
    onError: (_error, _nextRating, context) => {
      queryClient.setQueryData(queryKey, context?.previous ?? null);
    },
    onSuccess: (savedRating) => {
      queryClient.setQueryData(queryKey, savedRating);
    },
  });
  const rating = ratingQuery.data ?? null;
  const saving = saveMutation.isPending;
  const error = saveMutation.isError
    ? "Could not save"
    : ratingQuery.isError
      ? "Rating unavailable"
      : null;
  const persist = saveMutation.mutate;

  const reasons =
    descriptor.targetType === "answer_explanation"
      ? EXPLANATION_REASONS
      : descriptor.targetType === "question"
        ? QUESTION_REASONS
        : INSIGHT_REASONS;
  const isQuestionRating = descriptor.targetType === "question";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="mr-1 text-xs text-muted-foreground">
        {isQuestionRating ? "Rate this question" : "Helpful?"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 rounded-full text-muted-foreground",
          rating?.vote === 1 &&
            "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        )}
        aria-label={
          isQuestionRating ? "This was a good question" : "This was helpful"
        }
        aria-pressed={rating?.vote === 1}
        disabled={saving}
        onClick={() =>
          void persist({ vote: 1, reasonCode: null, reasonText: null })
        }
      >
        <ThumbsUp className="size-3.5" />
      </Button>
      <Popover
        open={reasonOpen}
        onOpenChange={(open) => {
          setReasonOpen(open);
          if (open) {
            setReasonText(rating?.reasonText ?? "");
            setSelectedReason(rating?.reasonCode ?? null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 rounded-full text-muted-foreground",
              rating?.vote === -1 &&
                "bg-rose-500/12 text-rose-700 dark:text-rose-300",
            )}
            aria-label={
              isQuestionRating
                ? "This question needs attention"
                : "This was not helpful"
            }
            aria-pressed={rating?.vote === -1}
            disabled={saving}
            onClick={() => {
              if (rating?.vote !== -1) {
                void persist({
                  vote: -1,
                  reasonCode: null,
                  reasonText: null,
                });
              }
              setReasonOpen(true);
            }}
          >
            <ThumbsDown className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(340px,calc(100vw-2rem))] p-4"
        >
          <p className="text-sm font-medium">
            {isQuestionRating
              ? "What should we review?"
              : "What could be better?"}
          </p>
          <div className="mt-3 grid gap-1">
            {reasons.map((reason) => (
              <button
                key={reason.code}
                type="button"
                disabled={saving}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60",
                  selectedReason === reason.code &&
                    "bg-primary/10 font-medium text-primary",
                )}
                aria-pressed={selectedReason === reason.code}
                onClick={() =>
                  setSelectedReason((current) =>
                    current === reason.code ? null : reason.code,
                  )
                }
              >
                {reason.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium">
            Add a note{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
            <Textarea
              className="mt-1.5 min-h-20 resize-none text-sm"
              maxLength={1000}
              value={reasonText}
              placeholder={
                isQuestionRating
                  ? "Tell us what seems wrong with this question"
                  : "Tell us what would make this more useful"
              }
              onChange={(event) => setReasonText(event.target.value)}
            />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-destructive" role="status">
              {error}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={saving || (!selectedReason && !reasonText.trim())}
              onClick={() => {
                persist(
                  {
                    vote: -1,
                    reasonCode: selectedReason,
                    reasonText: reasonText.trim() || null,
                  },
                  {
                    onSuccess: () => setReasonOpen(false),
                  },
                );
              }}
            >
              {saving ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {error && !reasonOpen ? (
        <span className="text-xs text-destructive" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
