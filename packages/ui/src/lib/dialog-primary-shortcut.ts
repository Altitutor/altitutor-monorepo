/**
 * Cmd/Ctrl+Enter activates the primary (usually bottom-right) action in open dialogs.
 */

export const DIALOG_PRIMARY_ACTION_ATTR = "data-dialog-primary-action";
export const DIALOG_CANCEL_ATTR = "data-dialog-cancel";

export const DIALOG_MODAL_CONTENT_SELECTOR =
  '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]';

function isDisabledButton(button: HTMLButtonElement): boolean {
  return (
    button.disabled ||
    button.getAttribute("aria-disabled") === "true" ||
    button.hasAttribute("disabled")
  );
}

function isCancelButton(button: HTMLButtonElement): boolean {
  return button.hasAttribute(DIALOG_CANCEL_ATTR);
}

function isDestructiveButton(button: HTMLButtonElement): boolean {
  if (button.hasAttribute(DIALOG_PRIMARY_ACTION_ATTR)) return false;
  return /\bdestructive\b/.test(button.className);
}

function isOpenOverlayPresent(): boolean {
  return Boolean(
    document.querySelector(
      '[role="listbox"], [data-radix-popper-content-wrapper] [role="option"]',
    ),
  );
}

export function getTopmostModalContent(): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    DIALOG_MODAL_CONTENT_SELECTOR,
  );
  return nodes.length > 0 ? nodes[nodes.length - 1]! : null;
}

function isPrimaryStyledButton(button: HTMLButtonElement): boolean {
  return /\bbg-primary\b/.test(button.className);
}

export function resolveDialogPrimaryAction(
  root: HTMLElement,
): HTMLButtonElement | null {
  const explicit = root.querySelectorAll<HTMLButtonElement>(
    `button[${DIALOG_PRIMARY_ACTION_ATTR}]`,
  );
  for (let i = explicit.length - 1; i >= 0; i -= 1) {
    const button = explicit[i]!;
    if (!isDisabledButton(button)) return button;
  }

  const footer = root.querySelector<HTMLElement>(
    '[data-slot="dialog-footer"], [data-slot="alert-dialog-footer"]',
  );
  const scope = footer ?? root;

  const buttons = Array.from(
    scope.querySelectorAll<HTMLButtonElement>("button"),
  ).filter((button) => !isDisabledButton(button) && !isCancelButton(button));

  // Prefer primary-styled actions (typical bottom-right Next / Save / Submit).
  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i]!;
    if (isPrimaryStyledButton(button)) return button;
  }

  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i]!;
    if (!isDestructiveButton(button)) return button;
  }

  // Last resort: allow an explicitly sole remaining footer button (e.g. Close).
  return buttons.at(-1) ?? null;
}

export function isDialogPrimaryShortcutEvent(event: KeyboardEvent): boolean {
  if (event.isComposing) return false;
  if (event.key !== "Enter") return false;
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (event.altKey || event.shiftKey) return false;
  return true;
}

/**
 * If this modal content is topmost and Cmd/Ctrl+Enter was pressed, click its
 * primary action. Returns true when the event was handled.
 */
export function tryActivateDialogPrimaryAction(
  root: HTMLElement,
  event: KeyboardEvent,
): boolean {
  if (!isDialogPrimaryShortcutEvent(event)) return false;
  if (root.getAttribute("data-primary-shortcut") === "off") return false;
  if (getTopmostModalContent() !== root) return false;
  if (isOpenOverlayPresent()) return false;

  // Leave Cmd/Ctrl+Enter to native text fields that opt out, or chat composers
  // outside dialogs. TipTap (contenteditable) and normal dialog textareas still
  // activate the dialog primary action (e.g. Next / Save).
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest("[data-dialog-primary-shortcut-ignore]")
  ) {
    return false;
  }

  const button = resolveDialogPrimaryAction(root);
  if (!button) return false;

  event.preventDefault();
  event.stopPropagation();
  button.click();
  return true;
}
