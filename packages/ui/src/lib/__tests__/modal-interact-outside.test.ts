/**
 * @jest-environment jsdom
 */
import {
  handleModalInteractOutside,
  isInsideModal,
  isPortaledOverlayTarget,
  isToastInteraction,
  isToastTarget,
} from '../modal-interact-outside';
import { clearPanelResizeActive, markPanelResizeActive } from '../panel-resize-guard';

describe('isInsideModal', () => {
  it('returns true when inside a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    expect(isInsideModal(button)).toBe(true);

    document.body.removeChild(dialog);
  });

  it('returns false outside dialogs', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    expect(isInsideModal(button)).toBe(false);

    document.body.removeChild(button);
  });
});

describe('isPortaledOverlayTarget', () => {
  it('returns true for clicks inside a portaled popover', () => {
    const popper = document.createElement('div');
    popper.setAttribute('data-radix-popper-content-wrapper', '');
    const button = document.createElement('button');
    popper.appendChild(button);
    document.body.appendChild(popper);

    expect(isPortaledOverlayTarget(button)).toBe(true);

    document.body.removeChild(popper);
  });

  it('returns false for clicks outside portaled overlays', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    expect(isPortaledOverlayTarget(button)).toBe(false);

    document.body.removeChild(button);
  });
});

describe('isToastTarget', () => {
  it('returns true for clicks inside a Sonner toast', () => {
    const toast = document.createElement('div');
    toast.setAttribute('data-sonner-toast', '');
    const button = document.createElement('button');
    toast.appendChild(button);
    document.body.appendChild(toast);

    expect(isToastTarget(button)).toBe(true);

    document.body.removeChild(toast);
  });

  it('returns true for clicks inside the app toast container marker', () => {
    const toaster = document.createElement('div');
    toaster.setAttribute('data-toast-container', '');
    const button = document.createElement('button');
    toaster.appendChild(button);
    document.body.appendChild(toaster);

    expect(isToastTarget(button)).toBe(true);

    document.body.removeChild(toaster);
  });
});

describe('handleModalInteractOutside', () => {
  it('prevents dismiss when interacting with a portaled popover', () => {
    const popper = document.createElement('div');
    popper.setAttribute('data-radix-popper-content-wrapper', '');
    const button = document.createElement('button');
    popper.appendChild(button);
    document.body.appendChild(popper);

    const event = {
      target: button,
      preventDefault: jest.fn(),
    } as unknown as Event;

    handleModalInteractOutside(event);
    expect(event.preventDefault).toHaveBeenCalled();

    document.body.removeChild(popper);
  });

  it('prevents dismiss when interacting with a Sonner toast action', () => {
    const toast = document.createElement('div');
    toast.setAttribute('data-sonner-toast', '');
    const button = document.createElement('button');
    toast.appendChild(button);
    document.body.appendChild(toast);

    const event = {
      target: button,
      preventDefault: jest.fn(),
    } as unknown as Event;

    handleModalInteractOutside(event);
    expect(event.preventDefault).toHaveBeenCalled();

    document.body.removeChild(toast);
  });

  it('recognizes a Radix outside event whose original event came from a toast', () => {
    const toast = document.createElement('div');
    toast.setAttribute('data-sonner-toast', '');
    const button = document.createElement('button');
    toast.appendChild(button);
    document.body.appendChild(toast);

    const originalEvent = {
      target: button,
      composedPath: () => [button, toast, document.body, document],
    } as unknown as Event;
    const event = new CustomEvent('pointerdownoutside', {
      detail: { originalEvent },
    });

    expect(isToastInteraction(event)).toBe(true);

    document.body.removeChild(toast);
  });

  it('prevents dismiss when Radix reports a resize separator as outside', () => {
    const separator = document.createElement('div');
    separator.setAttribute('data-separator', 'task-editor-handle');
    document.body.appendChild(separator);

    const originalEvent = {
      target: separator,
      composedPath: () => [separator, document.body, document],
    } as unknown as Event;
    const event = new CustomEvent('pointerdownoutside', {
      detail: { originalEvent },
      cancelable: true,
    });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalInteractOutside(event);

    expect(preventDefault).toHaveBeenCalled();

    document.body.removeChild(separator);
  });

  it('prevents dismiss while a resize handle drag is active', () => {
    const handle = document.createElement('div');
    handle.setAttribute('data-resize-handle-active', 'true');
    document.body.appendChild(handle);

    const event = new CustomEvent('pointerdownoutside', {
      cancelable: true,
    });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalInteractOutside(event);

    expect(preventDefault).toHaveBeenCalled();

    document.body.removeChild(handle);
  });

  it('prevents dismiss while body panel resize flag is active', () => {
    document.body.setAttribute('data-panel-resize-active', 'true');

    const event = new CustomEvent('pointerdownoutside', {
      cancelable: true,
    });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalInteractOutside(event);

    expect(preventDefault).toHaveBeenCalled();

    document.body.removeAttribute('data-panel-resize-active');
  });

  it('prevents dismiss shortly after a resize drag ends', () => {
    const handle = document.createElement('div');
    markPanelResizeActive(handle);
    clearPanelResizeActive(handle);

    const event = new CustomEvent('pointerdownoutside', {
      cancelable: true,
    });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    handleModalInteractOutside(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});
