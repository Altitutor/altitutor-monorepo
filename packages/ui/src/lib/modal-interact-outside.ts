import * as React from 'react';
import {
  isNativeDateTimeInputElement,
  markNativeDateTimePickerActive,
  scheduleNativeDateTimePickerCooldown,
  shouldPreventDialogDismissOnInteractOutside,
} from './native-datetime-input';

const PORTALED_OVERLAY_SELECTOR = [
  '[data-radix-popper-content-wrapper]',
  '[data-radix-popover-content]',
  '[data-radix-select-content]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-context-menu-content]',
  '[data-radix-menu-content]',
].join(', ');

const TOAST_SELECTOR = [
  '[data-toast-container]',
  '[data-sonner-toaster]',
  '[data-sonner-toast]',
].join(', ');

/** Returns true when `element` sits inside a modal dialog or sheet. */
export function isInsideModal(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  return Boolean(element.closest('[role="dialog"]'));
}

/** Radix popovers/menus/selects portaled to document.body while a modal is open. */
export function isPortaledOverlayTarget(target: Event['target']): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(PORTALED_OVERLAY_SELECTOR));
}

/** Sonner toasts are portaled above dialogs and should remain interactive. */
export function isToastTarget(target: Event['target']): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(TOAST_SELECTOR));
}

function eventPathIncludesSelector(event: Event, selector: string): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.some((target) => target instanceof HTMLElement && Boolean(target.closest(selector)));
}

export function isToastInteraction(event: Event): boolean {
  if (isToastTarget(event.target) || eventPathIncludesSelector(event, TOAST_SELECTOR)) {
    return true;
  }

  const originalEvent = (event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent;
  if (!originalEvent) return false;

  return isToastTarget(originalEvent.target) || eventPathIncludesSelector(originalEvent, TOAST_SELECTOR);
}

/** Shared handler for Radix Dialog / Sheet / AlertDialog outside interactions. */
export function handleModalInteractOutside(
  event: Event,
  extra?: (event: Event) => boolean
): void {
  if (shouldPreventDialogDismissOnInteractOutside(event)) {
    event.preventDefault();
    return;
  }

  if (isPortaledOverlayTarget(event.target)) {
    event.preventDefault();
    return;
  }

  if (isToastInteraction(event)) {
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
