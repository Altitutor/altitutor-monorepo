import { isMessageComposerSendShortcut } from '../composerShortcut';

const base = { key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('isMessageComposerSendShortcut', () => {
  it('sends on cmd+enter and ctrl+enter', () => {
    expect(isMessageComposerSendShortcut({ ...base, metaKey: true })).toBe(true);
    expect(isMessageComposerSendShortcut({ ...base, ctrlKey: true })).toBe(true);
  });

  it('lets enter insert a new line', () => {
    expect(isMessageComposerSendShortcut(base)).toBe(false);
    expect(isMessageComposerSendShortcut({ ...base, shiftKey: true })).toBe(false);
    expect(isMessageComposerSendShortcut({ ...base, metaKey: true, shiftKey: true })).toBe(false);
  });
});
