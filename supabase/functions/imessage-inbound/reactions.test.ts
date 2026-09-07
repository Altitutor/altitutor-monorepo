import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  MESSAGE_REACTION_TYPES,
  normalizeInboundReactionType,
} from "./reactions.ts";

const CHECK_TOKENS = new Set<string>(MESSAGE_REACTION_TYPES);

function wouldViolateReactionTypeCheck(value: string | null): boolean {
  return value !== null && !CHECK_TOKENS.has(value);
}

describe("inbound reaction_type insert shape", () => {
  it("nulls Apple custom-tapback type 2006 so insert no longer violates CHECK", () => {
    const inserted = normalizeInboundReactionType("2006");
    expect(inserted).toBeNull();
    expect(wouldViolateReactionTypeCheck(inserted)).toBe(false);
  });

  it("nulls a raw custom emoji so insert no longer violates CHECK", () => {
    const inserted = normalizeInboundReactionType("🥲");
    expect(inserted).toBeNull();
    expect(wouldViolateReactionTypeCheck(inserted)).toBe(false);
  });

  it("maps known tapbacks onto CHECK tokens and never stores an emoji string", () => {
    const cases: Array<[string, (typeof MESSAGE_REACTION_TYPES)[number] | null]> =
      [
        ["love", "love"],
        ["LIKE", "like"],
        ["❤️", "love"],
        ["👍", "like"],
        ["👎", "dislike"],
        ["😂", "laugh"],
        ["‼️", "emphasize"],
        ["❓", "question"],
        ["2000", "love"],
        ["2001", "like"],
        ["2002", "dislike"],
        ["2003", "laugh"],
        ["2004", "emphasize"],
        ["2005", "question"],
        ["remove-love", null],
        ["-like", null],
        ["3000", null],
        ["3006", null],
        ["2006", null],
        ["🥲", null],
        ["", null],
      ];

    for (const [raw, expected] of cases) {
      const inserted = normalizeInboundReactionType(raw);
      expect(wouldViolateReactionTypeCheck(inserted)).toBe(false);
      expect(inserted).toBe(expected);
      if (inserted !== null) {
        expect(CHECK_TOKENS.has(inserted)).toBe(true);
      }
    }
  });
});
