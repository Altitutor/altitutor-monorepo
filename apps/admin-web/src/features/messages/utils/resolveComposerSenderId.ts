import type { Sender } from '../types';

/**
 * Pick the owned number to reply from: last inbound destination if we still
 * have that sender, otherwise the default (or first compatible) sender.
 */
export function resolveComposerSenderId(args: {
  availableSenders: Sender[];
  lastInboundOwnedNumberId?: string | null;
  groupChatId?: string | null;
}): string | null {
  const compatibleSenders = args.groupChatId
    ? args.availableSenders.filter((sender) => sender.provider === 'IMESSAGE')
    : args.availableSenders;

  if (args.lastInboundOwnedNumberId) {
    const lastInboundSender = compatibleSenders.find(
      (sender) => sender.id === args.lastInboundOwnedNumberId
    );
    if (lastInboundSender) return lastInboundSender.id;
  }

  const defaultSender =
    compatibleSenders.find((sender) => sender.is_default) || compatibleSenders[0];
  return defaultSender?.id ?? null;
}
