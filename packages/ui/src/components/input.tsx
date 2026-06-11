"use client"

import * as React from "react"

import { cn } from "../lib/cn"
import {
  isNativeDateTimeInputType,
  isValidDateValue,
  isValidTimeValue,
  markNativeDateTimePickerActive,
  NATIVE_DATETIME_INPUT_CLASSNAME,
  normalizeDateInput,
  normalizeTimeInput,
  scheduleNativeDateTimePickerCooldown,
  shouldUseTextDateTimeInput,
  textDateTimePlaceholder,
  type NativeDateTimeInputType,
} from "../lib/native-datetime-input"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function useTextDateTimeMode(type: string | undefined): boolean {
  const [useTextMode, setUseTextMode] = React.useState(false);

  React.useEffect(() => {
    setUseTextMode(shouldUseTextDateTimeInput(type));
  }, [type]);

  return useTextMode;
}

function commitTextDateTimeValue(
  type: NativeDateTimeInputType,
  raw: string,
  onChange?: React.ChangeEventHandler<HTMLInputElement>
): string {
  const normalized =
    type === 'time' ? normalizeTimeInput(raw) : normalizeDateInput(raw);
  const nextValue = normalized ?? raw;

  onChange?.({
    target: { value: nextValue },
  } as React.ChangeEvent<HTMLInputElement>);

  return nextValue;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      value,
      onChange,
      onFocus,
      onBlur,
      placeholder,
      inputMode,
      autoComplete,
      ...props
    },
    ref
  ) => {
    const useTextMode =
      useTextDateTimeMode(type) && isNativeDateTimeInputType(type);
    const dateTimeType = isNativeDateTimeInputType(type) ? type : null;

    const hasExplicitValue = value !== undefined;
    const hasOnChange = onChange !== undefined;

    const [draftValue, setDraftValue] = React.useState<string>(() =>
      hasExplicitValue ? String(value ?? '') : ''
    );

    React.useEffect(() => {
      if (!useTextMode || !hasExplicitValue) return;
      setDraftValue(String(value ?? ''));
    }, [useTextMode, hasExplicitValue, value]);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (!useTextMode && isNativeDateTimeInputType(type)) {
        markNativeDateTimePickerActive();
      }
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (useTextMode && dateTimeType) {
        const committed = commitTextDateTimeValue(
          dateTimeType,
          event.target.value,
          onChange
        );
        setDraftValue(committed);
      } else if (isNativeDateTimeInputType(type)) {
        scheduleNativeDateTimePickerCooldown();
      }
      onBlur?.(event);
    };

    const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraftValue(event.target.value);
      onChange?.(event);
    };

    const resolvedType = useTextMode ? 'text' : type;

    const ariaInvalid =
      useTextMode && draftValue
        ? dateTimeType === 'time'
          ? !isValidTimeValue(draftValue) &&
            normalizeTimeInput(draftValue) === null
          : !isValidDateValue(draftValue) &&
            normalizeDateInput(draftValue) === null
        : undefined;

    return (
      <input
        {...props}
        type={resolvedType}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isNativeDateTimeInputType(type) && NATIVE_DATETIME_INPUT_CLASSNAME,
          className
        )}
        ref={ref}
        {...(hasExplicitValue
          ? {
              value: useTextMode ? draftValue : String(value ?? ''),
            }
          : {})}
        onChange={
          useTextMode
            ? handleTextChange
            : hasOnChange
              ? onChange
              : undefined
        }
        placeholder={
          useTextMode && dateTimeType
            ? (placeholder ?? textDateTimePlaceholder(dateTimeType))
            : placeholder
        }
        inputMode={
          useTextMode && dateTimeType === 'time' ? 'numeric' : inputMode
        }
        autoComplete={useTextMode ? 'off' : autoComplete}
        aria-invalid={ariaInvalid ?? props['aria-invalid']}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
