type HandleContact = {
  phone_e164?: string | null;
  email?: string | null;
} | null | undefined;

function trimmed(value: string | null | undefined): string | null {
  const handle = value?.trim();
  return handle ? handle : null;
}

/** Phone when present, otherwise an Apple ID email. */
export function messagingHandle(contact: HandleContact): string | null {
  return trimmed(contact?.phone_e164) ?? trimmed(contact?.email);
}

export function outboundMessageDestination(input: {
  groupChatId?: string | null;
  phone?: string | null;
  email?: string | null;
  provider?: string | null;
  replyAddress?: string | null;
}): string | null {
  const groupChatId = trimmed(input.groupChatId);
  if (groupChatId) return groupChatId;
  const phone = trimmed(input.phone);
  const email = trimmed(input.email);
  const replyAddress = trimmed(input.replyAddress);
  if (replyAddress && phone && replyAddress === phone) return phone;
  if (input.provider === 'IMESSAGE' && replyAddress && email
    && replyAddress.toLowerCase() === email.toLowerCase()) return email;
  if (phone) return phone;
  if (input.provider === 'IMESSAGE') return email;
  return null;
}

export function isAppleIdEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
