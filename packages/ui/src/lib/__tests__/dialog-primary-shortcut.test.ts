/**
 * @jest-environment jsdom
 *
 * Tests for dialog primary Cmd/Ctrl+Enter shortcut helpers
 */

import {
  DIALOG_CANCEL_ATTR,
  DIALOG_PRIMARY_ACTION_ATTR,
  resolveDialogPrimaryAction,
  tryActivateDialogPrimaryAction,
} from '../dialog-primary-shortcut';

function button(
  label: string,
  options?: {
    primary?: boolean;
    cancel?: boolean;
    disabled?: boolean;
    className?: string;
  },
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  if (options?.primary) el.setAttribute(DIALOG_PRIMARY_ACTION_ATTR, '');
  if (options?.cancel) el.setAttribute(DIALOG_CANCEL_ATTR, '');
  if (options?.disabled) el.disabled = true;
  if (options?.className) el.className = options.className;
  return el;
}

function dialogWithFooter(buttons: HTMLButtonElement[]): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-slot', 'dialog-content');
  const footer = document.createElement('div');
  footer.setAttribute('data-slot', 'dialog-footer');
  for (const btn of buttons) footer.appendChild(btn);
  root.appendChild(footer);
  document.body.appendChild(root);
  return root;
}

describe('resolveDialogPrimaryAction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers an explicit primary action attribute', () => {
    const primary = button('Save', { primary: true });
    const root = dialogWithFooter([
      button('Cancel', { cancel: true }),
      button('Secondary'),
      primary,
    ]);
    expect(resolveDialogPrimaryAction(root)).toBe(primary);
  });

  it('falls back to a primary-styled button when DialogFooter is missing', () => {
    const root = document.createElement('div');
    root.setAttribute('data-slot', 'dialog-content');
    const customFooter = document.createElement('div');
    const next = button('Next', { className: 'bg-primary text-primary-foreground' });
    customFooter.appendChild(button('Previous'));
    customFooter.appendChild(next);
    root.appendChild(customFooter);
    document.body.appendChild(root);
    expect(resolveDialogPrimaryAction(root)).toBe(next);
  });

  it('falls back to the last non-cancel, non-destructive footer button', () => {
    const save = button('Save');
    const root = dialogWithFooter([
      button('Cancel', { cancel: true }),
      button('Delete', { className: 'bg-destructive text-destructive-foreground' }),
      save,
    ]);
    expect(resolveDialogPrimaryAction(root)).toBe(save);
  });

  it('still activates an explicit primary even when destructive-styled', () => {
    const del = button('Delete', {
      primary: true,
      className: 'bg-destructive text-destructive-foreground',
    });
    const root = dialogWithFooter([button('Cancel', { cancel: true }), del]);
    expect(resolveDialogPrimaryAction(root)).toBe(del);
  });
});

describe('tryActivateDialogPrimaryAction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clicks the primary action on cmd+enter for the topmost dialog', () => {
    const primary = button('Save', { primary: true });
    const click = jest.fn();
    primary.addEventListener('click', click);
    const root = dialogWithFooter([button('Cancel', { cancel: true }), primary]);

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const handled = tryActivateDialogPrimaryAction(root, event);
    expect(handled).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('ignores nested dialogs that are not topmost', () => {
    const lowerPrimary = button('Lower', { primary: true });
    const lowerClick = jest.fn();
    lowerPrimary.addEventListener('click', lowerClick);
    const lower = dialogWithFooter([lowerPrimary]);

    const upperPrimary = button('Upper', { primary: true });
    dialogWithFooter([upperPrimary]);

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(tryActivateDialogPrimaryAction(lower, event)).toBe(false);
    expect(lowerClick).not.toHaveBeenCalled();
  });
});
