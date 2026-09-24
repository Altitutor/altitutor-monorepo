const REACTION_EMOJI: Record<string, string> = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  laugh: '😂',
  emphasize: '‼️',
  question: '❓',
};

const REACTION_LABEL: Record<string, string> = {
  love: 'Loved',
  like: 'Liked',
  dislike: 'Disliked',
  laugh: 'Laughed',
  emphasize: 'Emphasized',
  question: 'Questioned',
};

export type MessageReaction = {
  id: string;
  emoji: string;
  type: string;
  label: string;
  direction: 'INBOUND' | 'OUTBOUND';
};

/** Strip BlueBubbles prefixes like `p:0/` so reaction GUIDs match message GUIDs. */
export function normalizeImessageGuid(guid: string | null | undefined): string | null {
  if (!guid) return null;
  const trimmed = guid.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('/');
  return parts[parts.length - 1] || trimmed;
}

export function normalizeReactionType(reactionType: string | null | undefined): {
  type: string | null;
  isRemoval: boolean;
} {
  if (!reactionType) return { type: null, isRemoval: false };
  const raw = reactionType.trim().toLowerCase();
  const isRemoval = raw.startsWith('remove');
  const type = raw.replace(/^remove[_\s-]?/, '').trim();
  return { type: type || null, isRemoval };
}

export function reactionTypeToEmoji(reactionType: string | null | undefined): string | null {
  const { type, isRemoval } = normalizeReactionType(reactionType);
  if (!type || isRemoval) return null;
  return REACTION_EMOJI[type] ?? null;
}

export function reactionTypeToLabel(reactionType: string | null | undefined): string {
  const { type, isRemoval } = normalizeReactionType(reactionType);
  if (!type) return isRemoval ? 'Tapback removed' : 'Reaction';
  const label = REACTION_LABEL[type] ?? type;
  return isRemoval ? `Removed ${label.toLowerCase()}` : label;
}

type ReactionSourceMessage = {
  id: string;
  is_reaction: boolean;
  reaction_type: string | null;
  associated_message_guid: string | null;
  imessage_guid: string | null;
  direction: string;
  created_at: string | null;
};

/**
 * Latest reaction wins per (target GUID, reaction type). Removals clear that type.
 */
export function buildReactionsByTargetGuid(
  messages: ReactionSourceMessage[]
): Map<string, MessageReaction[]> {
  const latestByKey = new Map<string, ReactionSourceMessage>();

  for (const message of messages) {
    if (!message.is_reaction) continue;
    const targetGuid = normalizeImessageGuid(message.associated_message_guid);
    const { type } = normalizeReactionType(message.reaction_type);
    if (!targetGuid || !type) continue;

    const key = `${targetGuid}::${type}`;
    const existing = latestByKey.get(key);
    const messageCreatedAt = message.created_at ?? '';
    const existingCreatedAt = existing?.created_at ?? '';
    if (!existing || messageCreatedAt >= existingCreatedAt) {
      latestByKey.set(key, message);
    }
  }

  const byTarget = new Map<string, MessageReaction[]>();

  for (const message of latestByKey.values()) {
    const targetGuid = normalizeImessageGuid(message.associated_message_guid);
    const emoji = reactionTypeToEmoji(message.reaction_type);
    const { type } = normalizeReactionType(message.reaction_type);
    if (!targetGuid || !emoji || !type) continue;

    const list = byTarget.get(targetGuid) ?? [];
    list.push({
      id: message.id,
      emoji,
      type,
      label: reactionTypeToLabel(message.reaction_type),
      direction: message.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
    });
    byTarget.set(targetGuid, list);
  }

  return byTarget;
}

export function collectAttachedReactionIds(
  messages: ReactionSourceMessage[],
  reactionsByTarget: Map<string, MessageReaction[]>
): Set<string> {
  const attached = new Set<string>();
  const targetGuids = new Set(
    messages
      .filter((message) => !message.is_reaction)
      .map((message) => normalizeImessageGuid(message.imessage_guid))
      .filter((guid): guid is string => !!guid)
  );

  for (const message of messages) {
    if (!message.is_reaction) continue;
    const targetGuid = normalizeImessageGuid(message.associated_message_guid);
    if (targetGuid && targetGuids.has(targetGuid) && reactionsByTarget.has(targetGuid)) {
      attached.add(message.id);
      continue;
    }
    // Hide removals even when the target is not loaded.
    const { isRemoval } = normalizeReactionType(message.reaction_type);
    if (isRemoval) attached.add(message.id);
  }

  // Also hide superseded reaction rows (older love replaced by newer love / remove).
  const latestIds = new Set(
    Array.from(reactionsByTarget.values()).flatMap((reactions) => reactions.map((r) => r.id))
  );
  for (const message of messages) {
    if (!message.is_reaction) continue;
    const targetGuid = normalizeImessageGuid(message.associated_message_guid);
    const { type, isRemoval } = normalizeReactionType(message.reaction_type);
    if (!targetGuid || !type) continue;
    if (isRemoval) {
      attached.add(message.id);
      continue;
    }
    if (targetGuids.has(targetGuid) && !latestIds.has(message.id)) {
      attached.add(message.id);
    }
  }

  return attached;
}
