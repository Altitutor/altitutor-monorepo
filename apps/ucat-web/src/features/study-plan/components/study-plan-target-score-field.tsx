"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertTriangle } from "lucide-react";
import {
  TARGET_SCORE_MAX,
  TARGET_SCORE_MIN,
  TARGET_SCORE_STEP,
  normalizeTargetScoreDraft,
} from "@/features/study-plan/lib/target-score";
import { cn } from "@/lib/utils";

export type StudyPlanTargetScoreFieldHandle = {
  validate: () => string | null;
};

type StudyPlanTargetScoreFieldProps = {
  value: number;
  onChange: (score: number) => void;
  onValidationChange?: (error: string | null) => void;
  disabled?: boolean;
  id?: string;
  showLowScoreWarning?: boolean;
  className?: string;
};

export const StudyPlanTargetScoreField = forwardRef<
  StudyPlanTargetScoreFieldHandle,
  StudyPlanTargetScoreFieldProps
>(function StudyPlanTargetScoreField(
  {
    value,
    onChange,
    onValidationChange,
    disabled = false,
    id = "study-target",
    showLowScoreWarning = true,
    className,
  },
  ref,
) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  useEffect(() => {
    setDraft(String(value));
    setError(null);
    onValidationChangeRef.current?.(null);
  }, [value]);

  function commitDraft(nextDraft: string): string | null {
    const { value: normalized, error: validationError } =
      normalizeTargetScoreDraft(nextDraft);
    setError(validationError);
    onValidationChange?.(validationError);

    if (validationError || normalized == null) {
      return validationError;
    }

    setDraft(String(normalized));
    if (normalized !== value) {
      onChange(normalized);
    }

    return null;
  }

  useImperativeHandle(ref, () => ({
    validate: () => commitDraft(draft),
  }));

  function handleBlur() {
    commitDraft(draft);
  }

  function handleChange(nextDraft: string) {
    setDraft(nextDraft);
    if (error) {
      setError(null);
      onValidationChange?.(null);
    }

    const parsed = Number(nextDraft);
    if (
      nextDraft !== "" &&
      Number.isInteger(parsed) &&
      parsed >= TARGET_SCORE_MIN &&
      parsed <= TARGET_SCORE_MAX &&
      parsed % TARGET_SCORE_STEP === 0
    ) {
      onChange(parsed);
    }
  }

  const parsedDraft = Number(draft);
  const showWarning =
    showLowScoreWarning &&
    !error &&
    draft !== "" &&
    Number.isInteger(parsedDraft) &&
    parsedDraft >= TARGET_SCORE_MIN &&
    parsedDraft <= TARGET_SCORE_MAX &&
    parsedDraft < 2000;

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:items-end", className)}>
      <label htmlFor={id} className="inline-flex items-baseline gap-1.5">
        <span className="sr-only">Target UCAT score</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={TARGET_SCORE_MIN}
          max={TARGET_SCORE_MAX}
          step={TARGET_SCORE_STEP}
          value={draft}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error
              ? `${id}-error`
              : showWarning
                ? `${id}-warning`
                : undefined
          }
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          className={cn(
            "w-[5.75rem] rounded-md border-0 bg-transparent p-0 text-right text-2xl font-bold tabular-nums tracking-tight text-foreground outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            error && "text-destructive",
          )}
        />
        <span className="text-sm font-medium text-muted-foreground">
          / {TARGET_SCORE_MAX}
        </span>
      </label>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="w-full text-sm text-destructive sm:max-w-xs sm:text-right"
        >
          {error}
        </p>
      ) : null}

      {showWarning ? (
        <div
          id={`${id}-warning`}
          className="flex w-full gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-foreground sm:max-w-xs"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <p>
            <strong className="font-semibold">This target may be too low.</strong>{" "}
            A score under 2000 is unlikely to be competitive for many interview
            offers.
          </p>
        </div>
      ) : null}
    </div>
  );
});
