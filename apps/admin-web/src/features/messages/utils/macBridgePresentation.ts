import type { Sender } from '../types';

export type AppleService = 'iMessage' | 'SMS';
export type ResendViaSmsAvailability = 'hidden' | 'unavailable' | 'offer' | 'confirm' | 'spent';

export const AMBIGUOUS_SMS_RESEND_CONFIRM =
  'The Mac may still deliver this iMessage. Resend via SMS anyway? The recipient could get both.';

export function asAppleService(value: string | null | undefined): AppleService | null {
  if (value === 'SMS' || value === 'iMessage') return value;
  return null;
}

export function asOwnedNumberProvider(
  value: string | null | undefined,
): 'TWILIO' | 'IMESSAGE' | null {
  if (value === 'TWILIO' || value === 'IMESSAGE') return value;
  return null;
}

const IMESSAGE_BLUE = 'bg-[#007AFF] dark:bg-[#0A84FF] text-white';
const SMS_GREEN = 'bg-[#30D158] dark:bg-[#1E8E3E] text-white';
const INBOUND_MUTED = 'bg-muted';

export function messageBubbleClassName(input: {
  direction: 'INBOUND' | 'OUTBOUND';
  provider: 'TWILIO' | 'IMESSAGE' | null;
  appleService: AppleService | null;
  isGroup: boolean;
}): string {
  if (input.direction === 'INBOUND' && input.provider !== 'IMESSAGE') {
    return INBOUND_MUTED;
  }
  if (input.isGroup) {
    return input.direction === 'OUTBOUND' ? IMESSAGE_BLUE : INBOUND_MUTED;
  }
  if (input.provider === 'TWILIO' && input.direction === 'OUTBOUND') {
    return SMS_GREEN;
  }
  if (input.provider === 'IMESSAGE' && input.appleService === 'SMS') {
    return SMS_GREEN;
  }
  if (input.provider === 'IMESSAGE') {
    return IMESSAGE_BLUE;
  }
  return input.direction === 'OUTBOUND' ? IMESSAGE_BLUE : INBOUND_MUTED;
}

export function outboundStatusClassName(status: string, isMacBridge = false): string {
  if (isMacBridge && status === 'FAILED') {
    return 'text-[11px] font-semibold text-destructive';
  }
  if (isMacBridge && status === 'AMBIGUOUS') {
    return 'text-[11px] font-semibold text-amber-600 dark:text-amber-400';
  }
  return 'text-[9px] text-muted-foreground';
}

export function resendViaSmsAvailability(input: {
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  body: string;
  provider: 'TWILIO' | 'IMESSAGE' | null;
  isGroup: boolean;
  spent: boolean;
}): ResendViaSmsAvailability {
  if (
    input.direction !== 'OUTBOUND' ||
    input.provider !== 'IMESSAGE' ||
    input.isGroup ||
    (input.status !== 'FAILED' && input.status !== 'AMBIGUOUS')
  ) {
    return 'hidden';
  }
  if (!input.body.trim()) return 'unavailable';
  if (input.spent) return 'spent';
  return input.status === 'AMBIGUOUS' ? 'confirm' : 'offer';
}

export function isResendViaSmsSpent(
  originalMessageId: string,
  messages: Array<{ resent_from_message_id: string | null; status: string }>,
): boolean {
  return messages.some(
    (message) =>
      message.resent_from_message_id === originalMessageId &&
      message.status !== 'FAILED' &&
      message.status !== 'UNDELIVERED',
  );
}

export function defaultPhoneSmsSender(senders: Sender[]): Sender | null {
  const phoneSms = senders.filter(
    (sender) => sender.provider === 'TWILIO' && sender.sender_type === 'PHONE',
  );
  return phoneSms.find((sender) => sender.is_default) ?? phoneSms[0] ?? null;
}
