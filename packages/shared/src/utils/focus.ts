type FocusableElement = HTMLElement & { focus: (options?: FocusOptions) => void };

/** Focus a command-palette search input reliably, including on mobile after dialogs open. */
export function focusCommandPaletteInput(element: FocusableElement | null | undefined): void {
  if (!element) return;

  const focus = () => {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      focus();
      window.setTimeout(focus, 50);
      window.setTimeout(focus, 150);
    });
  });
}
