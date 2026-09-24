import {
  defaultPhoneSmsSender,
  isResendViaSmsSpent,
  messageBubbleClassName,
  outboundStatusClassName,
  resendViaSmsAvailability,
} from '../macBridgePresentation';
import type { Sender } from '../../types';

const BLUE = 'bg-[#007AFF] dark:bg-[#0A84FF] text-white';
const GREEN = 'bg-[#30D158] dark:bg-[#1E8E3E] text-white';
const MUTED = 'bg-muted';

describe('messageBubbleClassName', () => {
  it('paints inbound muted and outbound Mac-line SMS green or iMessage blue', () => {
    expect(
      messageBubbleClassName({
        direction: 'INBOUND',
        provider: 'IMESSAGE',
        appleService: 'SMS',
        isGroup: false,
      }),
    ).toBe(MUTED);
    expect(
      messageBubbleClassName({
        direction: 'INBOUND',
        provider: 'IMESSAGE',
        appleService: 'iMessage',
        isGroup: false,
      }),
    ).toBe(MUTED);
    expect(
      messageBubbleClassName({
        direction: 'INBOUND',
        provider: 'IMESSAGE',
        appleService: null,
        isGroup: false,
      }),
    ).toBe(MUTED);
    expect(
      messageBubbleClassName({
        direction: 'OUTBOUND',
        provider: 'IMESSAGE',
        appleService: 'SMS',
        isGroup: false,
      }),
    ).toBe(GREEN);
    expect(
      messageBubbleClassName({
        direction: 'OUTBOUND',
        provider: 'IMESSAGE',
        appleService: null,
        isGroup: false,
      }),
    ).toBe(BLUE);
  });

  it('keeps SMS-owned outbound green and inbound muted', () => {
    expect(
      messageBubbleClassName({
        direction: 'OUTBOUND',
        provider: 'TWILIO',
        appleService: null,
        isGroup: false,
      }),
    ).toBe(GREEN);
    expect(
      messageBubbleClassName({
        direction: 'INBOUND',
        provider: 'TWILIO',
        appleService: 'SMS',
        isGroup: false,
      }),
    ).toBe(MUTED);
  });

  it('does not paint group chats as SMS', () => {
    expect(
      messageBubbleClassName({
        direction: 'INBOUND',
        provider: 'IMESSAGE',
        appleService: 'SMS',
        isGroup: true,
      }),
    ).toBe(MUTED);
    expect(
      messageBubbleClassName({
        direction: 'OUTBOUND',
        provider: 'IMESSAGE',
        appleService: 'SMS',
        isGroup: true,
      }),
    ).toBe(BLUE);
  });
});

describe('outboundStatusClassName', () => {
  it('makes Failed and Ambiguous distinct from Sent on Mac-bridge rows', () => {
    expect(outboundStatusClassName('FAILED', true)).toContain('text-destructive');
    expect(outboundStatusClassName('AMBIGUOUS', true)).toContain('text-amber');
    expect(outboundStatusClassName('SENT', true)).not.toContain('text-destructive');
    expect(outboundStatusClassName('SENT', true)).not.toContain('text-amber');
    expect(outboundStatusClassName('FAILED', true)).not.toBe(
      outboundStatusClassName('AMBIGUOUS', true),
    );
    expect(outboundStatusClassName('FAILED')).not.toContain('text-destructive');
  });
});

describe('resendViaSmsAvailability', () => {
  it('offers one-click on Failed Mac DMs with text and confirm on Ambiguous', () => {
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'FAILED',
        body: 'Can you come in at 4?',
        provider: 'IMESSAGE',
        isGroup: false,
        spent: false,
      }),
    ).toBe('offer');
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'AMBIGUOUS',
        body: 'Can you come in at 4?',
        provider: 'IMESSAGE',
        isGroup: false,
        spent: false,
      }),
    ).toBe('confirm');
  });

  it('hides or disables when the spec says not to resend', () => {
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'FAILED',
        body: '',
        provider: 'IMESSAGE',
        isGroup: false,
        spent: false,
      }),
    ).toBe('unavailable');
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'FAILED',
        body: 'Hi',
        provider: 'IMESSAGE',
        isGroup: true,
        spent: false,
      }),
    ).toBe('hidden');
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'SENT',
        body: 'Hi',
        provider: 'IMESSAGE',
        isGroup: false,
        spent: false,
      }),
    ).toBe('hidden');
  });

  it('spends the action while a linked SMS send is not failed', () => {
    expect(
      resendViaSmsAvailability({
        direction: 'OUTBOUND',
        status: 'FAILED',
        body: 'Hi',
        provider: 'IMESSAGE',
        isGroup: false,
        spent: true,
      }),
    ).toBe('spent');
    expect(
      isResendViaSmsSpent('mac-1', [
        { resent_from_message_id: 'mac-1', status: 'QUEUED' },
      ]),
    ).toBe(true);
    expect(
      isResendViaSmsSpent('mac-1', [
        { resent_from_message_id: 'mac-1', status: 'FAILED' },
      ]),
    ).toBe(false);
  });
});

describe('defaultPhoneSmsSender', () => {
  it('picks the default PHONE SMS owned number and skips alphanumeric', () => {
    const senders: Sender[] = [
      {
        id: 'mac',
        phone_e164: '+61483849842',
        alphanumeric_sender_id: null,
        sender_type: 'PHONE',
        label: 'iMessage',
        is_default: true,
        provider: 'IMESSAGE',
      },
      {
        id: 'alpha',
        phone_e164: null,
        alphanumeric_sender_id: 'ALTITUTOR',
        sender_type: 'ALPHANUMERIC',
        label: 'ALTITUTOR',
        is_default: false,
        provider: 'TWILIO',
      },
      {
        id: 'sms',
        phone_e164: '+61468064000',
        alphanumeric_sender_id: null,
        sender_type: 'PHONE',
        label: 'Primary AU',
        is_default: false,
        provider: 'TWILIO',
      },
    ];
    expect(defaultPhoneSmsSender(senders)?.id).toBe('sms');
  });
});
