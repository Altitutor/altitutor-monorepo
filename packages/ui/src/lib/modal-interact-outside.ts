import * as React from 'react';
import {
  isNativeDateTimeInputElement,
  markNativeDateTimePickerActive,
  scheduleNativeDateTimePickerCooldown,
  shouldPreventDialogDismissOnInteractOutside,
} from './native-datetime-input';

/** Shared handler for Radix Dialog / Sheet / AlertDialog outside interactions. */
export function handleModalInteractOutside(
  event: Event,
  extra?: (event: Event) => boolean
): void {
  if (shouldPreventDialogDismissOnInteractOutside(event)) {
    event.preventDefault();
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target?.closest('[data-toast-container]')) {
    event.preventDefault();
    return;
  }

  if (extra?.(event)) {
    event.preventDefault();
  }
}

/** Track native date/time focus inside modal content (incl. raw inputs). */
export function useModalNativeDateTimeFocusGuards<T extends HTMLElement>() {
  const contentRef = React.useRef<T | null>(null);

  React.useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const onFocusIn = (event: FocusEvent) => {
      if (isNativeDateTimeInputElement(event.target as Element)) {
        markNativeDateTimePickerActive();
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (isNativeDateTimeInputElement(event.target as Element)) {
        scheduleNativeDateTimePickerCooldown();
      }
    };

    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const setContentRef = React.useCallback(
    (node: T | null) => {
      contentRef.current = node;
    },
    []
  );

  return setContentRef;
}
