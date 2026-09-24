type FocusableElement = HTMLElement & { focus: (options?: FocusOptions) => void };

const DEFAULT_FOCUS_DELAYS_MS = [0, 50, 150] as const;

/** Focus a command-palette search input reliably, including on mobile after dialogs open. */
export function focusCommandPaletteInput(
  element: FocusableElement | null | undefined,
  options?: { delaysMs?: readonly number[] },
): void {
  if (!element) return;

  const focus = () => {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  };

  const delaysMs = options?.delaysMs ?? DEFAULT_FOCUS_DELAYS_MS;

  for (const delayMs of delaysMs) {
    if (delayMs <= 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(focus);
      });
      continue;
    }
    setTimeout(focus, delayMs);
  }
}
