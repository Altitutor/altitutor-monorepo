export type CalculatorEngineState = {
  display: string;
  memory: number;
};

type InternalState = {
  display: string;
  memory: number;
  accumulator: number | null;
  pendingOp: string | null;
  fresh: boolean;
};

function parseDisplay(display: string): number {
  const n = Number(display);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

function compute(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

export function createCalculatorEngine(): {
  getState: () => CalculatorEngineState;
  pressKey: (label: string) => CalculatorEngineState;
  reset: () => CalculatorEngineState;
} {
  let state: InternalState = {
    display: "0",
    memory: 0,
    accumulator: null,
    pendingOp: null,
    fresh: true,
  };

  const snapshot = (): CalculatorEngineState => ({
    display: state.display,
    memory: state.memory,
  });

  const pressKey = (label: string): CalculatorEngineState => {
    if (/^[0-9]$/.test(label)) {
      state.display = state.fresh ? label : state.display === "0" ? label : state.display + label;
      state.fresh = false;
      return snapshot();
    }

    if (label === ".") {
      if (state.fresh) {
        state.display = "0.";
        state.fresh = false;
      } else if (!state.display.includes(".")) {
        state.display += ".";
      }
      return snapshot();
    }

    if (label === "ON/C") {
      state = { display: "0", memory: state.memory, accumulator: null, pendingOp: null, fresh: true };
      return snapshot();
    }

    if (label === "+/-") {
      const n = parseDisplay(state.display);
      state.display = formatNumber(-n);
      return snapshot();
    }

    if (label === "sqrt") {
      const n = parseDisplay(state.display);
      state.display = formatNumber(Math.sqrt(n));
      state.fresh = true;
      return snapshot();
    }

    if (label === "%") {
      const n = parseDisplay(state.display);
      state.display = formatNumber(n / 100);
      state.fresh = true;
      return snapshot();
    }

    if (label === "M+") {
      state.memory += parseDisplay(state.display);
      return snapshot();
    }

    if (label === "M-") {
      state.memory -= parseDisplay(state.display);
      return snapshot();
    }

    if (label === "MRC") {
      state.display = formatNumber(state.memory);
      state.fresh = true;
      return snapshot();
    }

    if (["+", "-", "×", "÷"].includes(label)) {
      const current = parseDisplay(state.display);
      if (state.accumulator != null && state.pendingOp && !state.fresh) {
        state.accumulator = compute(state.accumulator, current, state.pendingOp);
        state.display = formatNumber(state.accumulator);
      } else {
        state.accumulator = current;
      }
      state.pendingOp = label;
      state.fresh = true;
      return snapshot();
    }

    if (label === "=") {
      const current = parseDisplay(state.display);
      if (state.accumulator != null && state.pendingOp) {
        const result = compute(state.accumulator, current, state.pendingOp);
        state.display = formatNumber(result);
        state.accumulator = null;
        state.pendingOp = null;
        state.fresh = true;
      }
      return snapshot();
    }

    return snapshot();
  };

  return {
    getState: snapshot,
    pressKey,
    reset: () => {
      state = { display: "0", memory: 0, accumulator: null, pendingOp: null, fresh: true };
      return snapshot();
    },
  };
}
