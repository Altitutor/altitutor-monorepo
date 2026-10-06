import {
  buildConversationPreview,
  contactSenderBadgeName,
  conversationListPreviewText,
  countsAsUnrepliedMessage,
  outboundSenderBadgeName,
  participantSenderBadgeName,
} from '../conversationPreview';

describe('countsAsUnrepliedMessage', () => {
  it('treats a real inbound message as unreplied', () => {
    expect(countsAsUnrepliedMessage({ direction: 'INBOUND', isReaction: false })).toBe(true);
  });

  it('does not treat an outbound message as unreplied', () => {
    expect(countsAsUnrepliedMessage({ direction: 'OUTBOUND', isReaction: false })).toBe(false);
  });

  it('does not treat an incoming reaction as unreplied', () => {
    expect(countsAsUnrepliedMessage({ direction: 'INBOUND', isReaction: true })).toBe(false);
  });
});

describe('conversationListPreviewText', () => {
  it('collapses whitespace and drops attachment placeholders', () => {
    expect(conversationListPreviewText({
      body: 'Hello\n\nthere \uFFFC OBJ',
      attachmentCount: 0,
    })).toBe('Hello there');
  });

  it('uses an attachment label when the body is only a placeholder', () => {
    expect(conversationListPreviewText({
      body: '\uFFFC',
      attachmentCount: 1,
    })).toBe('Attachment');
  });
});

describe('sender badge names', () => {
  it('uses the contact first name', () => {
    expect(contactSenderBadgeName({
      students: { first_name: 'Ada', last_name: 'Lovelace' },
    })).toBe('Ada');
  });

  it('uses the staff first name for outbound messages', () => {
    expect(outboundSenderBadgeName({ first_name: 'Grace', last_name: 'Hopper' })).toBe('Grace');
  });

  it('matches a group sender by phone', () => {
    expect(participantSenderBadgeName('+61400000000', [
      { name: 'Alan Turing', phone: '0400000000', email: null },
    ])).toBe('Alan');
  });
});

describe('buildConversationPreview', () => {
  it.each(['FAILED', 'UNDELIVERED'])('marks outbound %s messages as failed', (status) => {
    expect(buildConversationPreview({
      direction: 'OUTBOUND', status, body: 'Hello', attachmentCount: 0, senderName: 'Grace',
    })?.failed).toBe(true);
  });

  it.each(['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'AMBIGUOUS'])('does not mark %s messages as failed', (status) => {
    expect(buildConversationPreview({
      direction: 'OUTBOUND', status, body: 'Hello', attachmentCount: 0, senderName: 'Grace',
    })?.failed).toBe(false);
  });

  it('does not mark inbound messages as failed', () => {
    expect(buildConversationPreview({
      direction: 'INBOUND', status: 'FAILED', body: 'Hello', attachmentCount: 0, senderName: 'Ada',
    })?.failed).toBe(false);
  });

  it('marks failed attachment previews', () => {
    expect(buildConversationPreview({
      direction: 'OUTBOUND', status: 'FAILED', body: '', attachmentCount: 1, senderName: 'Grace',
    })).toMatchObject({ text: 'Attachment', failed: true });
  });

  it('returns null when there is nothing to show', () => {
    expect(buildConversationPreview({
      direction: 'INBOUND',
      body: '   ',
      attachmentCount: 0,
      senderName: 'Ada',
    })).toBeNull();
  });
});
