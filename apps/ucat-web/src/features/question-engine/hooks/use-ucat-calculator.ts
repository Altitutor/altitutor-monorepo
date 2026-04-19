"use client";

import { useCallback, useState } from "react";

type Operation = "+" | "-" | "×" | "÷";
type ImmediateOperation = "+/-" | "√" | "%";
type MemoryOperation = "MRC" | "M+" | "M-";

type KeyType =
  | "ON/C"
  | "number"
  | "operation"
  | "immediateoperation"
  | "memory";

type CalculatorKey =
  | "ON/C"
  | "."
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "+"
  | "-"
  | "×"
  | "÷"
  | "="
  | "+/-"
  | "√"
  | "%"
  | "MRC"
  | "M+"
  | "M-";

type Calculations = Array<number | Operation>;

type CalculatorState = {
  textValue: string;
  priorTextValue: string;
  numberValue: number;
  priorNumberValue: number;
  operationApplied: boolean;
  negative: boolean;
  hasError: boolean;

  followOrderOfOperations: boolean;
  calculations: Calculations;
  priorCalculations: [number, Operation] | [];
  runningTotal?: number;
  priorOperator?: Operation;
  equalsHit: boolean;

  memoryValue: number;
  onButtonClickedOnce: boolean;
  memoryButtonClickedOnce: boolean;
};

const MAX_ABS_VALUE = 99_999_999;

const INITIAL_STATE: CalculatorState = {
  textValue: "0",
  priorTextValue: "",
  numberValue: 0,
  priorNumberValue: 0,
  operationApplied: false,
  negative: false,
  hasError: false,

  // Match original behaviour: follow order of operations (MDAS) by default
  followOrderOfOperations: true,
  calculations: [],
  priorCalculations: [],
  runningTotal: undefined,
  priorOperator: undefined,
  equalsHit: false,

  memoryValue: 0,
  onButtonClickedOnce: false,
  memoryButtonClickedOnce: false,
};

const KEY_TYPE_MAP: Record<CalculatorKey, KeyType> = {
  "ON/C": "ON/C",
  ".": "number",
  "0": "number",
  "1": "number",
  "2": "number",
  "3": "number",
  "4": "number",
  "5": "number",
  "6": "number",
  "7": "number",
  "8": "number",
  "9": "number",
  "+": "operation",
  "-": "operation",
  "×": "operation",
  "÷": "operation",
  "=": "operation",
  "+/-": "immediateoperation",
  "√": "immediateoperation",
  "%": "immediateoperation",
  MRC: "memory",
  "M+": "memory",
  "M-": "memory",
};

function isDigitChar(char: string): boolean {
  return Number.isInteger(Number(char));
}

function withError(state: CalculatorState): CalculatorState {
  return {
    ...state,
    textValue: "",
    priorTextValue: "",
    numberValue: 0,
    priorNumberValue: 0,
    operationApplied: false,
    negative: false,
    hasError: true,
  };
}

function setDisplayValue(
  state: CalculatorState,
  value?: number,
): CalculatorState {
  let nextNumberValue = value !== undefined ? value : state.numberValue;
  if (
    Number.isFinite(nextNumberValue) &&
    Math.abs(nextNumberValue) <= MAX_ABS_VALUE
  ) {
    nextNumberValue = Math.round(nextNumberValue * 1e8) / 1e8;
  }

  if (
    !Number.isFinite(nextNumberValue) ||
    nextNumberValue > MAX_ABS_VALUE ||
    nextNumberValue < -MAX_ABS_VALUE
  ) {
    return withError(state);
  }

  let textValue = String(nextNumberValue);

  const digitCount = textValue
    .split("")
    .filter((char) => isDigitChar(char)).length;

  if (digitCount > 8) {
    const decimalPosition = textValue.indexOf(".");
    const absValue = Math.abs(nextNumberValue);

    if (decimalPosition === -1) {
      textValue = String(absValue);
    } else {
      const places = Math.max(0, 8 - decimalPosition);
      textValue = String(+absValue.toFixed(places));
    }
  } else {
    textValue = String(Math.abs(nextNumberValue));
  }

  const negative = nextNumberValue < 0;

  return {
    ...state,
    textValue,
    priorTextValue: textValue,
    numberValue: nextNumberValue,
    priorNumberValue: nextNumberValue,
    operationApplied: true,
    negative,
    hasError: false,
  };
}

function clearDisplay(state: CalculatorState): CalculatorState {
  return {
    ...state,
    textValue: "0",
    numberValue: 0,
    priorTextValue: "",
    priorNumberValue: 0,
    operationApplied: false,
    negative: false,
    hasError: false,
  };
}

function clearTotals(state: CalculatorState): CalculatorState {
  if (state.followOrderOfOperations) {
    return {
      ...state,
      calculations: [],
      priorCalculations: [],
      runningTotal: undefined,
      priorOperator: undefined,
      equalsHit: false,
      onButtonClickedOnce: false,
    };
  }

  return {
    ...state,
    runningTotal: undefined,
    priorOperator: undefined,
    equalsHit: false,
    onButtonClickedOnce: false,
  };
}

function updateDisplayNumber(
  state: CalculatorState,
  numberButton: string,
): CalculatorState {
  const { priorTextValue } = state;
  let { textValue, operationApplied, negative } = state;

  let displayLength = textValue
    .split("")
    .filter((char) => isDigitChar(char)).length;

  if (operationApplied && textValue === priorTextValue) {
    textValue = "";
    displayLength = 0;
    operationApplied = false;
    negative = false;
  }

  const canAddDigit =
    displayLength < 8 &&
    ((numberButton === "." && !textValue.includes(".")) ||
      numberButton !== ".");

  if (!canAddDigit) {
    return state;
  }

  if (textValue === "" && numberButton === ".") {
    textValue = "0";
  }

  textValue =
    (textValue === "0" && numberButton !== "." ? "" : textValue) + numberButton;

  const numberValue = Number(textValue) * (negative ? -1 : 1);

  return {
    ...state,
    textValue,
    numberValue,
    operationApplied,
    negative,
    hasError: false,
  };
}

function immediateOperations(
  state: CalculatorState,
  char: ImmediateOperation,
): CalculatorState {
  if (state.textValue === "") {
    return state;
  }

  if (char === "+/-") {
    const numberValue = -state.numberValue;
    return setDisplayValue(state, numberValue);
  }

  if (char === "%") {
    const priorOp = state.priorCalculations[1];

    if (state.calculations.length === 0 && state.runningTotal === undefined) {
      return setDisplayValue(state, state.numberValue / 100);
    }

    if (!priorOp) {
      return setDisplayValue(state, state.numberValue / 100);
    }

    return setDisplayValue(
      state,
      state.priorNumberValue * (state.numberValue / 100),
    );
  }

  if (char === "√") {
    return setDisplayValue(state, Math.sqrt(state.numberValue));
  }

  return state;
}

function updateCalculations(
  state: CalculatorState,
  operator: Operation,
): CalculatorState {
  const priorCalculations: [number, Operation] = [state.numberValue, operator];
  const calculations = state.calculations.concat(priorCalculations);

  return {
    ...state,
    priorCalculations,
    calculations,
    operationApplied: true,
    priorTextValue: state.textValue,
  };
}

function calculateTotal(
  state: CalculatorState,
  numberValue: number,
): CalculatorState {
  const calculations: Calculations = [...state.calculations, numberValue];
  const working = [...calculations];
  let priorCalculations: [number, Operation] | [] = [];

  const hasOperator = (list: Calculations, ops: Operation[]) =>
    list.some((x) => typeof x === "string" && ops.includes(x as Operation));

  while (hasOperator(working, ["+", "-", "×", "÷"])) {
    let operationIndex = -1;
    let tmp = 0;

    if (hasOperator(working, ["×", "÷"])) {
      const multIndex = working.indexOf("×");
      const divIndex = working.indexOf("÷");

      if (divIndex === -1 || (multIndex !== -1 && multIndex < divIndex)) {
        operationIndex = multIndex;
        tmp =
          (working[multIndex - 1] as number) *
          (working[multIndex + 1] as number);
      } else {
        operationIndex = divIndex;
        tmp =
          (working[divIndex - 1] as number) / (working[divIndex + 1] as number);
      }
    } else if (hasOperator(working, ["+", "-"])) {
      const addIndex = working.indexOf("+");
      const subIndex = working.indexOf("-");

      if (subIndex === -1 || (addIndex !== -1 && addIndex < subIndex)) {
        operationIndex = addIndex;
        tmp =
          (working[addIndex - 1] as number) + (working[addIndex + 1] as number);
      } else {
        operationIndex = subIndex;
        tmp =
          (working[subIndex - 1] as number) - (working[subIndex + 1] as number);
      }
    }

    if (operationIndex <= 0) {
      break;
    }

    priorCalculations = [
      working[operationIndex - 1] as number,
      working[operationIndex] as Operation,
    ];
    working.splice(operationIndex, 2);
    working[operationIndex - 1] = tmp;
  }

  const finalValue = (working.pop() as number) ?? 0;

  return {
    ...setDisplayValue(state, finalValue),
    calculations: [],
    priorCalculations,
  };
}

function updateRunningTotal(
  state: CalculatorState,
  operator: Operation | "=",
): CalculatorState {
  let { runningTotal, priorOperator, equalsHit, priorCalculations } = state;
  const currentValue = state.numberValue;
  let numberValue = state.numberValue;

  if (operator === "=" && equalsHit && priorCalculations.length) {
    operator = priorCalculations[1];
    numberValue = priorCalculations[0];
  } else if (equalsHit && operator !== "=") {
    priorCalculations = [];
    runningTotal = undefined;
    priorOperator = undefined;
    equalsHit = false;
  } else {
    priorCalculations = [];
  }

  if (priorOperator !== undefined && runningTotal !== undefined) {
    switch (priorOperator) {
      case "+":
        runningTotal = runningTotal + numberValue;
        break;
      case "-":
        runningTotal = runningTotal - numberValue;
        break;
      case "×":
        runningTotal = runningTotal * numberValue;
        break;
      case "÷":
        runningTotal = runningTotal / numberValue;
        break;
    }
  } else {
    runningTotal = numberValue;
  }

  if (operator !== "=") {
    priorCalculations = [currentValue, operator as Operation];
    priorOperator = operator as Operation;
  } else if (!equalsHit) {
    priorCalculations = [currentValue, operator as Operation];
    equalsHit = true;
  }

  return {
    ...setDisplayValue(state, runningTotal ?? 0),
    runningTotal,
    priorOperator,
    priorCalculations,
    equalsHit,
  };
}

function updateMemory(
  state: CalculatorState,
  mButton: MemoryOperation,
): CalculatorState {
  let { memoryValue } = state;

  if (state.textValue === "") {
    return state;
  }

  if (mButton === "M+") {
    const newValue = memoryValue + state.numberValue;
    if (
      !Number.isFinite(newValue) ||
      newValue > MAX_ABS_VALUE ||
      newValue < -MAX_ABS_VALUE
    ) {
      return withError(state);
    }
    memoryValue = newValue;
    return {
      ...state,
      memoryValue,
      hasError: false,
    };
  }

  if (mButton === "M-") {
    const newValue = memoryValue - state.numberValue;
    if (
      !Number.isFinite(newValue) ||
      newValue > MAX_ABS_VALUE ||
      newValue < -MAX_ABS_VALUE
    ) {
      return withError(state);
    }
    memoryValue = newValue;
    return {
      ...state,
      memoryValue,
      hasError: false,
    };
  }

  // MRC behaviour: first press recalls, second press clears memory
  if (state.memoryButtonClickedOnce) {
    return {
      ...state,
      memoryValue: 0,
      memoryButtonClickedOnce: false,
      hasError: false,
    };
  }

  return {
    ...setDisplayValue(state, memoryValue),
    memoryButtonClickedOnce: true,
  };
}

function computeNextState(
  prev: CalculatorState,
  rawKey: string,
): CalculatorState {
  const key = (rawKey === "sqrt" ? "√" : rawKey) as CalculatorKey;

  if (!(key in KEY_TYPE_MAP)) {
    return prev;
  }

  const keyType = KEY_TYPE_MAP[key];

  if (prev.hasError && key !== "ON/C") {
    return prev;
  }

  let state = prev;

  if (key !== "ON/C") {
    state = {
      ...state,
      onButtonClickedOnce: false,
    };
  }

  if (key !== "MRC") {
    state = {
      ...state,
      memoryButtonClickedOnce: false,
    };
  }

  switch (keyType) {
    case "ON/C": {
      if (state.onButtonClickedOnce) {
        return clearTotals(state);
      }

      return {
        ...clearDisplay(state),
        onButtonClickedOnce: true,
      };
    }

    case "number":
      return updateDisplayNumber(state, key);

    case "operation": {
      if (state.textValue === "") {
        return state;
      }

      if (state.followOrderOfOperations) {
        if (key !== "=") {
          return updateCalculations(state, key as Operation);
        }

        return calculateTotal(state, state.numberValue);
      }

      return updateRunningTotal(state, key as Operation | "=");
    }

    case "immediateoperation":
      return immediateOperations(state, key as ImmediateOperation);

    case "memory":
      return updateMemory(state, key as MemoryOperation);

    default:
      return state;
  }
}

function formatDisplay(state: CalculatorState): string {
  if (state.hasError) {
    return "Error";
  }

  if (state.textValue === "") {
    return "";
  }

  const base = state.negative ? `-${state.textValue}` : state.textValue;
  const suffix = base.includes(".") ? "" : ".";

  return `${base}${suffix}`;
}

export function useUcatCalculator() {
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);

  const onKey = useCallback((label: string) => {
    setState((current) => computeNextState(current, label));
  }, []);

  return {
    display: formatDisplay(state),
    onKey,
  };
}
