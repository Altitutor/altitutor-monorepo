/**
 * @jest-environment jsdom
 */
import {
  handleModalInteractOutside,
  isPortaledOverlayTarget,
} from '../modal-interact-outside';

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
});
