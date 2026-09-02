import { getMessagingDraftKey } from '../messagingUiStore';

describe('getMessagingDraftKey', () => {
  it('keys contact drafts by contact id', () => {
    expect(getMessagingDraftKey({ kind: 'contact', contactId: 'c-1' })).toBe('contact:c-1');
  });

  it('returns null when the contact id is missing', () => {
    expect(getMessagingDraftKey({ kind: 'contact', contactId: null })).toBeNull();
  });

  it('keys group drafts by conversation id', () => {
    expect(getMessagingDraftKey({ kind: 'group', conversationId: 'g-1' })).toBe('group:g-1');
  });
});
