/** Tailwind classes for native date/time inputs (Safari mobile overflow). */
export const NATIVE_DATETIME_INPUT_CLASSNAME =
  'min-w-0 max-w-full overflow-hidden [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit-fields-wrapper]:min-w-0';

export type NativeDateTimeInputType = 'date' | 'time' | 'datetime-local';

export function isNativeDateTimeInputType(
  type?: string
): type is NativeDateTimeInputType {
  return type === 'date' || type === 'time' || type === 'datetime-local';
}

export function isNativeDateTimeInputElement(
  element: Element | null | undefined
): element is HTMLInputElement {
  if (typeof HTMLInputElement === 'undefined') return false;
  return (
    element instanceof HTMLInputElement &&
    isNativeDateTimeInputType(element.type)
  );
}

/** iPhone, iPod, iPad (incl. iPadOS reporting as MacIntel). */
export function isTouchIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function shouldUseTextDateTimeInput(type?: string): boolean {
  return isTouchIOS() && isNativeDateTimeInputType(type);
}

const DATE_VALUE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateValue(value: string): boolean {
  if (!DATE_VALUE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function normalizeDateInput(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (isValidDateValue(cleaned)) return cleaned;
  return null;
}

const TIME_VALUE_RE = /^(\d{1,2}):(\d{2})$/;

export function isValidTimeValue(value: string): boolean {
  const match = value.match(TIME_VALUE_RE);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function normalizeTimeInput(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  if (TIME_VALUE_RE.test(cleaned)) {
    const [, hours, minutes] = cleaned.match(TIME_VALUE_RE) ?? [];
    const normalized = `${hours!.padStart(2, '0')}:${minutes}`;
    return isValidTimeValue(normalized) ? normalized : null;
  }

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, '0');
    const hours = padded.slice(0, 2);
    const minutes = padded.slice(2, 4);
    const normalized = `${hours}:${minutes}`;
    return isValidTimeValue(normalized) ? normalized : null;
  }

  return null;
}

/** Placeholder shown for text-mode date/time inputs on iOS. */
export function textDateTimePlaceholder(
  type: NativeDateTimeInputType
): string {
  switch (type) {
    case 'date':
      return 'YYYY-MM-DD';
    case 'time':
      return 'HH:MM';
    case 'datetime-local':
      return 'YYYY-MM-DD HH:MM';
  }
}

/**
 * iOS Safari renders native date/time pickers outside the dialog DOM. Dismissing
 * the picker fires Radix "interact outside" and closes the parent modal.
 */
let nativeDateTimePickerActive = false;
let nativeDateTimePickerCooldownTimer: ReturnType<typeof setTimeout> | null =
  null;

const NATIVE_PICKER_COOLDOWN_MS = 400;

export function markNativeDateTimePickerActive(): void {
  nativeDateTimePickerActive = true;
  if (nativeDateTimePickerCooldownTimer) {
    clearTimeout(nativeDateTimePickerCooldownTimer);
    nativeDateTimePickerCooldownTimer = null;
  }
}

export function scheduleNativeDateTimePickerCooldown(): void {
  nativeDateTimePickerActive = true;
  if (nativeDateTimePickerCooldownTimer) {
    clearTimeout(nativeDateTimePickerCooldownTimer);
  }
  nativeDateTimePickerCooldownTimer = setTimeout(() => {
    nativeDateTimePickerActive = false;
    nativeDateTimePickerCooldownTimer = null;
  }, NATIVE_PICKER_COOLDOWN_MS);
}

export function isNativeDateTimePickerRecentlyActive(): boolean {
  return nativeDateTimePickerActive;
}

export function shouldPreventDialogDismissOnInteractOutside(
  event: Event
): boolean {
  if (isNativeDateTimePickerRecentlyActive()) return true;
  if (
    typeof document !== 'undefined' &&
    isNativeDateTimeInputElement(document.activeElement)
  ) {
    return true;
  }

  const target = event.target as Element | null;
  if (isNativeDateTimeInputElement(target)) return true;
  if (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    target.closest('input[type="date"], input[type="time"], input[type="datetime-local"]')
  ) {
    return true;
  }

  return false;
}

/** Reset state between tests. */
export function resetNativeDateTimePickerStateForTests(): void {
  nativeDateTimePickerActive = false;
  if (nativeDateTimePickerCooldownTimer) {
    clearTimeout(nativeDateTimePickerCooldownTimer);
    nativeDateTimePickerCooldownTimer = null;
  }
}
