import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  applyCalculatorKey,
  createInitialCalculatorState,
  formatCalculatorDisplay,
} from "../features/skill-trainer/lib/ucat-calculator";
function press(keys: string[]) {
  return keys.reduce(applyCalculatorKey, createInitialCalculatorState());
}
function display(keys: string[]) {
  return formatCalculatorDisplay(press(keys));
}
test("UCAT calculator evaluates left to right and continues from results", () => {
  assert.equal(display(["1", "2", "-", "4", "×", "2", "="]), "16.");
  assert.equal(display(["1", "0", "+", "5", "=", "×", "2", "="]), "30.");
});
test("web keypad labels trigger roots, signs, percentages, and decimals", () => {
  assert.equal(display(["9", "sqrt"]), "3.");
  assert.equal(display(["5", "+/-"]), "-5.");
  assert.equal(display(["2", "5", "%"]), "0.25");
  assert.equal(display(["0", ".", "1", "+", "0", ".", "2", "="]), "0.3");
});
test("memory recalls once and clears on a second consecutive MRC", () => {
  const state = press(["1", "0", "M+", "ON/C", "5", "M-", "MRC"]);
  assert.equal(formatCalculatorDisplay(state), "5.");
  assert.equal(state.memoryValue, 5);
  assert.equal(applyCalculatorKey(state, "MRC").memoryValue, 0);
});
test("two clear presses reset pending operations while retaining memory", () => {
  const state = press([
    "8",
    "M+",
    "+",
    "5",
    "ON/C",
    "ON/C",
    "2",
    "+",
    "3",
    "=",
  ]);
  assert.equal(formatCalculatorDisplay(state), "5.");
  assert.equal(state.memoryValue, 8);
});
test("division by zero locks Error until clear and caps entry at eight digits", () => {
  assert.equal(display(["1", "÷", "0", "=", "2"]), "Error");
  assert.equal(display(["1", "÷", "0", "=", "ON/C"]), "0.");
  assert.equal(
    display(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "12345678.",
  );
});
