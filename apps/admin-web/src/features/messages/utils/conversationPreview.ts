import { messagingHandle } from './messagingHandle';

export type ConversationPreviewDirection = 'INBOUND' | 'OUTBOUND';

export type ConversationMessagePreview = {
  senderName: string;
  text: string;
  failed?: boolean;
  /** INBOUND is from the contact. OUTBOUND is to the contact. */
  direction: ConversationPreviewDirection;
};

type NamedPerson = {
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined;

type PreviewContact = {
  phone_e164?: string | null;
  email?: string | null;
  students?: NamedPerson;
  parents?: NamedPerson;
  staff?: NamedPerson;
} | null | undefined;

export function countsAsUnrepliedMessage(
  message: { direction: string | null | undefined; isReaction: boolean } | null | undefined,
): boolean {
  if (!message || message.isReaction) return false;
  return message.direction === 'INBOUND';
}

export function conversationListPreviewText(input: {
  body: string | null | undefined;
  attachmentCount: number;
}): string {
  const cleaned = (input.body ?? '')
    .replace(/\uFFFC/g, '')
    .replace(/\bOBJ\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  if (input.attachmentCount > 0) return 'Attachment';
  return '';
}

export function personBadgeName(person: NamedPerson, fallback: string): string {
  const first = person?.first_name?.trim();
  if (first) return first;
  const last = person?.last_name?.trim();
  if (last) return last;
  return fallback;
}

export function contactSenderBadgeName(contact: PreviewContact): string {
  const person = contact?.students ?? contact?.parents ?? contact?.staff;
  return personBadgeName(person, messagingHandle(contact) ?? 'Unknown');
}

export function outboundSenderBadgeName(
  staff: NamedPerson | NamedPerson[],
): string {
  const person = Array.isArray(staff) ? staff[0] : staff;
  return personBadgeName(person, 'Staff');
}

function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function phonesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const local = (digits: string) =>
    digits.startsWith('61') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
  return local(left) === local(right);
}

export function participantSenderBadgeName(
  fromHandle: string | null | undefined,
  participants: Array<{ name: string; phone: string | null; email: string | null }>,
): string {
  const fromDigits = phoneDigits(fromHandle);
  const fromEmail = fromHandle?.trim().toLowerCase() ?? '';
  const match = participants.find((participant) => {
    if (phonesMatch(fromDigits, phoneDigits(participant.phone))) return true;
    const email = participant.email?.trim().toLowerCase() ?? '';
    return Boolean(fromEmail && email && email === fromEmail);
  });
  if (match) {
    const first = match.name.trim().split(/\s+/)[0];
    return first || match.name;
  }
  const handle = fromHandle?.trim();
  return handle || 'Unknown';
}

export function buildConversationPreview(input: {
  direction: string;
  status?: string | null;
  body: string | null | undefined;
  attachmentCount: number;
  senderName: string;
}): ConversationMessagePreview | null {
  const text = conversationListPreviewText(input);
  if (!text) return null;
  return {
    senderName: input.senderName,
    text,
    failed: input.direction === 'OUTBOUND' && (input.status === 'FAILED' || input.status === 'UNDELIVERED'),
    direction: input.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
  };
}
