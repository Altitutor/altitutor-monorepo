import {
  getAnswerOptionShortcutKey,
} from "@/features/question-engine/model/shortcuts";

describe("getAnswerOptionShortcutKey", () => {
  it("maps physical KeyA–KeyF even when Option dead-key composition mangled event.key", () => {
    // iPadOS after Option+N (tilde dead key): first letter arrives composed.
    expect(
      getAnswerOptionShortcutKey({
        code: "KeyA",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe("a");
    expect(
      getAnswerOptionShortcutKey({
        code: "KeyB",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe("b");
  });

  it("ignores Option/Alt chords so calculator and navigation stay on Alt+letter", () => {
    expect(
      getAnswerOptionShortcutKey({
        code: "KeyC",
        altKey: true,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBeNull();
    expect(
      getAnswerOptionShortcutKey({
        code: "KeyA",
        altKey: false,
        ctrlKey: true,
        metaKey: false,
      }),
    ).toBeNull();
  });

  it("ignores keys outside A–F", () => {
    expect(
      getAnswerOptionShortcutKey({
        code: "KeyN",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBeNull();
    expect(
      getAnswerOptionShortcutKey({
        code: "Digit1",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBeNull();
  });
});
