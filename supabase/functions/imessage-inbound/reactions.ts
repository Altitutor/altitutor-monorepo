/** CHECK tokens on `messages.reaction_type` (do not widen without a migration). */
export const MESSAGE_REACTION_TYPES = [
  "love",
  "like",
  "dislike",
  "laugh",
  "emphasize",
  "question",
] as const;

export type MessageReactionType = typeof MESSAGE_REACTION_TYPES[number];

const CHECK_TOKENS = new Set<string>(MESSAGE_REACTION_TYPES);

/** Apple associatedMessageType 2000–2005 (BlueBubbles / Messages.app). */
const APPLE_ASSOCIATED_TYPE: Record<string, MessageReactionType> = {
  "2000": "love",
  "2001": "like",
  "2002": "dislike",
  "2003": "laugh",
  "2004": "emphasize",
  "2005": "question",
};

const NAMED_ALIASES: Record<string, MessageReactionType> = {
  love: "love",
  like: "like",
  dislike: "dislike",
  laugh: "laugh",
  emphasize: "emphasize",
  emphasise: "emphasize",
  question: "question",
  loved: "love",
  liked: "like",
  disliked: "dislike",
  laughed: "laugh",
  emphasized: "emphasize",
  questioned: "question",
  heart: "love",
  "thumbs-up": "like",
  thumbs_up: "like",
  "thumbs-down": "dislike",
  thumbs_down: "dislike",
  haha: "laugh",
  exclaim: "emphasize",
  exclamation: "emphasize",
};

const EMOJI_ALIASES: Record<string, MessageReactionType> = {
  "❤️": "love",
  "❤": "love",
  "♥️": "love",
  "♥": "love",
  "👍": "like",
  "👎": "dislike",
  "😂": "laugh",
  "‼️": "emphasize",
  "❗❗": "emphasize",
  "❗": "emphasize",
  "❓": "question",
  "❔": "question",
};

function stripRemovalPrefix(
  raw: string,
): { isRemoval: boolean; remainder: string } {
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith("remove")) {
    return {
      isRemoval: true,
      remainder: lower.replace(/^remove[_\s-]?/, "").trim(),
    };
  }
  if (lower.startsWith("-")) {
    return { isRemoval: true, remainder: lower.slice(1).trim() };
  }
  // Apple associatedMessageType 3000–3006 are tapback removals.
  if (/^300[0-6]$/.test(lower)) {
    return { isRemoval: true, remainder: "" };
  }
  return { isRemoval: false, remainder: lower };
}

/**
 * Map a provider reaction string onto `messages.reaction_type` CHECK tokens.
 * Unknown types, custom emoji tapbacks (Apple 2006), and removals become null
 * so inbound does not crash the whole event.
 */
export function normalizeInboundReactionType(
  raw: string | null | undefined,
): MessageReactionType | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const { isRemoval, remainder } = stripRemovalPrefix(trimmed);
  if (isRemoval) return null;

  if (CHECK_TOKENS.has(remainder)) {
    return remainder as MessageReactionType;
  }

  const named = NAMED_ALIASES[remainder];
  if (named) return named;

  const apple = APPLE_ASSOCIATED_TYPE[trimmed];
  if (apple) return apple;

  const withoutVariationSelector = trimmed.replaceAll("\uFE0F", "");
  const emoji = EMOJI_ALIASES[trimmed] ??
    EMOJI_ALIASES[withoutVariationSelector];
  if (emoji) return emoji;

  return null;
}
