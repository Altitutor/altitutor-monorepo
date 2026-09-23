import { isAppleIdEmail, messagingHandle, outboundMessageDestination } from '../messagingHandle';

describe('messagingHandle', () => {
  it('prefers a phone and falls back to an Apple ID email', () => {
    expect(messagingHandle({ phone_e164: '+61412345678', email: 'person@icloud.com' })).toBe('+61412345678');
    expect(messagingHandle({ phone_e164: null, email: 'phoebetkd01@gmail.com' })).toBe('phoebetkd01@gmail.com');
    expect(messagingHandle({ phone_e164: '  ', email: '  ' })).toBeNull();
  });
});

describe('outboundMessageDestination', () => {
  it('sends an email-only contact through iMessage', () => {
    expect(outboundMessageDestination({
      phone: null,
      email: 'phoebetkd01@gmail.com',
      provider: 'IMESSAGE',
    })).toBe('phoebetkd01@gmail.com');
  });

  it('does not send an email-only contact through SMS', () => {
    expect(outboundMessageDestination({
      phone: null,
      email: 'phoebetkd01@gmail.com',
      provider: 'TWILIO',
    })).toBeNull();
  });

  it('keeps a phone destination and a group chat id', () => {
    expect(outboundMessageDestination({
      phone: '+61412345678',
      email: 'person@icloud.com',
      provider: 'IMESSAGE',
    })).toBe('+61412345678');
    expect(outboundMessageDestination({
      groupChatId: 'chat123',
      phone: null,
      email: null,
      provider: 'IMESSAGE',
    })).toBe('chat123');
  });
});

describe('isAppleIdEmail', () => {
  it('accepts an email and rejects a phone', () => {
    expect(isAppleIdEmail('phoebetkd01@gmail.com')).toBe(true);
    expect(isAppleIdEmail('+61412345678')).toBe(false);
  });
});
