import { applyNumpadKey } from "@/features/skill-trainer/lib/numpad-input";

describe("applyNumpadKey", () => {
  it("clears the entire sequence for ON/C", () => {
    expect(applyNumpadKey(["1", "2", "+", "3"], "ON/C")).toEqual([]);
  });

  it("appends ordinary calculator keys", () => {
    expect(applyNumpadKey(["1"], "2")).toEqual(["1", "2"]);
  });
});
