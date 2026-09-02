import {
  applyUnreadToCachedConversations,
  unreadBadgeDeltaForCache,
  type ConversationUnreadTarget,
} from '../conversationUnreadCache';

const contactA = {
  kind: 'contact',
  contactId: 'c-1',
  unreadCount: 2,
  conversations: [{ id: 'conv-a' }, { id: 'conv-b' }],
};
const group = {
  kind: 'group',
  conversationId: 'g-1',
  unreadCount: 1,
};

describe('conversation unread cache', () => {
  it('marks a contact as read without changing other rows', () => {
    expect(
      applyUnreadToCachedConversations([contactA, group], { contactId: 'c-1' }, false)
    ).toEqual([
      { ...contactA, unreadCount: 0 },
      group,
    ]);
  });

  it('marks a nested contact conversation as unread', () => {
    const readContact = { ...contactA, unreadCount: 0 };
    expect(
      applyUnreadToCachedConversations([readContact, group], { conversationId: 'conv-b' }, true)
    ).toEqual([
      { ...readContact, unreadCount: 1 },
      group,
    ]);
  });

  it('computes the navbar badge delta from the current unread state', () => {
    expect(unreadBadgeDeltaForCache([contactA, group], { contactId: 'c-1' }, false)).toBe(-1);
    expect(unreadBadgeDeltaForCache([contactA, group], { contactId: 'c-1' }, true)).toBe(0);
    expect(unreadBadgeDeltaForCache([{ ...contactA, unreadCount: 0 }], { contactId: 'c-1' }, true)).toBe(1);
  });
});
