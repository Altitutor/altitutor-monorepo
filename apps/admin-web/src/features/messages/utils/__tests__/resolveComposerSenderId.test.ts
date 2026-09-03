import { resolveComposerSenderId } from '../resolveComposerSenderId';
import type { Sender } from '../../types';

function sender(overrides: Partial<Sender> & Pick<Sender, 'id'>): Sender {
  return {
    phone_e164: '+61400000000',
    alphanumeric_sender_id: null,
    sender_type: 'PHONE',
    label: overrides.id,
    is_default: false,
    provider: 'TWILIO',
    ...overrides,
  };
}

const defaultSms = sender({ id: 'default-sms', is_default: true, phone_e164: '+61411111111' });
const otherSms = sender({ id: 'other-sms', phone_e164: '+61422222222' });
const imessage = sender({
  id: 'imessage-1',
  provider: 'IMESSAGE',
  phone_e164: '+61433333333',
});

describe('resolveComposerSenderId', () => {
  it('uses the owned number the last inbound message was sent to', () => {
    expect(
      resolveComposerSenderId({
        availableSenders: [defaultSms, otherSms],
        lastInboundOwnedNumberId: 'other-sms',
      })
    ).toBe('other-sms');
  });

  it('falls back to the default sender when there is no inbound message', () => {
    expect(
      resolveComposerSenderId({
        availableSenders: [otherSms, defaultSms],
        lastInboundOwnedNumberId: null,
      })
    ).toBe('default-sms');
  });

  it('falls back to the default sender when the last inbound number is gone', () => {
    expect(
      resolveComposerSenderId({
        availableSenders: [defaultSms, otherSms],
        lastInboundOwnedNumberId: 'retired-number',
      })
    ).toBe('default-sms');
  });

  it('restricts group chats to iMessage senders', () => {
    expect(
      resolveComposerSenderId({
        availableSenders: [defaultSms, imessage],
        lastInboundOwnedNumberId: 'default-sms',
        groupChatId: 'group-1',
      })
    ).toBe('imessage-1');
  });
});
