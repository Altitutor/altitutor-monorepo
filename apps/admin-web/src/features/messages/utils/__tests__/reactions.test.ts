import {
  buildReactionsByTargetGuid,
  collectAttachedReactionIds,
  normalizeImessageGuid,
  reactionTypeToEmoji,
  reactionTypeToLabel,
} from '../reactions';

describe('normalizeImessageGuid', () => {
  it('strips BlueBubbles part prefixes', () => {
    expect(normalizeImessageGuid('p:0/FFDBE07B-803E-4A22-B84F-15FEEA658F53')).toBe(
      'FFDBE07B-803E-4A22-B84F-15FEEA658F53'
    );
  });

  it('keeps bare GUIDs', () => {
    expect(normalizeImessageGuid('BBD1B64A-E962-40F4-BA2E-F4BF9504A6B3')).toBe(
      'BBD1B64A-E962-40F4-BA2E-F4BF9504A6B3'
    );
  });
});

describe('reactionTypeToEmoji', () => {
  it('maps tapbacks to emojis', () => {
    expect(reactionTypeToEmoji('love')).toBe('❤️');
    expect(reactionTypeToEmoji('like')).toBe('👍');
    expect(reactionTypeToEmoji('laugh')).toBe('😂');
  });

  it('returns null for removals', () => {
    expect(reactionTypeToEmoji('remove-love')).toBeNull();
    expect(reactionTypeToEmoji('remove_like')).toBeNull();
  });
});

describe('reactionTypeToLabel', () => {
  it('labels tapbacks', () => {
    expect(reactionTypeToLabel('love')).toBe('Loved');
  });
});

describe('buildReactionsByTargetGuid', () => {
  it('attaches the latest non-removed reaction per type', () => {
    const messages = [
      {
        id: 'r1',
        is_reaction: true,
        reaction_type: 'love',
        associated_message_guid: 'p:0/TARGET',
        imessage_guid: 'R1',
        direction: 'INBOUND',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'r2',
        is_reaction: true,
        reaction_type: 'like',
        associated_message_guid: 'TARGET',
        imessage_guid: 'R2',
        direction: 'OUTBOUND',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'r3',
        is_reaction: true,
        reaction_type: 'remove-love',
        associated_message_guid: 'TARGET',
        imessage_guid: 'R3',
        direction: 'INBOUND',
        created_at: '2026-01-03T00:00:00Z',
      },
      {
        id: 'm1',
        is_reaction: false,
        reaction_type: null,
        associated_message_guid: null,
        imessage_guid: 'TARGET',
        direction: 'OUTBOUND',
        created_at: '2025-12-31T00:00:00Z',
      },
    ];

    const byTarget = buildReactionsByTargetGuid(messages);
    expect(byTarget.get('TARGET')?.map((r) => r.type)).toEqual(['like']);
    expect(byTarget.get('TARGET')?.[0]?.emoji).toBe('👍');

    const attached = collectAttachedReactionIds(messages, byTarget);
    expect(attached.has('r1')).toBe(true);
    expect(attached.has('r2')).toBe(true);
    expect(attached.has('r3')).toBe(true);
  });
});
