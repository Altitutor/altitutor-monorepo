import {
  applyCalculatorKey,
  createInitialCalculatorState,
  formatCalculatorDisplay,
} from "@/features/question-engine/hooks/use-ucat-calculator";

function press(
  keys: string[],
  start = createInitialCalculatorState(),
): ReturnType<typeof createInitialCalculatorState> {
  return keys.reduce((state, key) => applyCalculatorKey(state, key), start);
}

function display(keys: string[]): string {
  return formatCalculatorDisplay(press(keys));
}

describe("useUcatCalculator (real UCAT / TI-108 behaviour)", () => {
  it("evaluates left-to-right without BODMAS", () => {
    // 12 - 4 × 2 = 16 on UCAT (not 4)
    expect(display(["1", "2", "-", "4", "×", "2", "="])).toBe("16.");
  });

  it("multiplies and square-roots via calculator key labels", () => {
    expect(display(["9", "sqrt"])).toBe("3.");
    expect(display(["5", "×", "5", "="])).toBe("25.");
  });

  it("supports memory shortcuts MRC / M+ / M-", () => {
    let state = press(["1", "0", "M+", "ON/C", "5", "M-"]);
    expect(state.memoryValue).toBe(5);

    state = applyCalculatorKey(state, "MRC");
    expect(formatCalculatorDisplay(state)).toBe("5.");
    expect(state.memoryButtonClickedOnce).toBe(true);

    state = applyCalculatorKey(state, "MRC");
    expect(state.memoryValue).toBe(0);
  });

  it("clears the display with ON/C (Backspace equivalent)", () => {
    const state = press(["1", "2", "3", "ON/C"]);
    expect(formatCalculatorDisplay(state)).toBe("0.");
  });

  it("second ON/C clears running totals", () => {
    const state = press([
      "1",
      "0",
      "+",
      "5",
      "ON/C",
      "ON/C",
      "2",
      "+",
      "3",
      "=",
    ]);
    expect(formatCalculatorDisplay(state)).toBe("5.");
  });

  it("continues from the last result when not cleared", () => {
    expect(display(["1", "0", "+", "5", "=", "×", "2", "="])).toBe("30.");
  });
});
