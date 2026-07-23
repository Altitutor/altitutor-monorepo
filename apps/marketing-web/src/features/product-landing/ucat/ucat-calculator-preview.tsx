"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, Sigma } from "lucide-react";
import { UcatFloatingPanel } from "@altitutor/ui";

type Operator = "+" | "-" | "×" | "÷";

const rows = [
  ["+/-", "sqrt", "%", "÷"],
  ["MRC", "M-", "M+", "×"],
  ["7", "8", "9", "-"],
  ["4", "5", "6", "+"],
] as const;

const buttonBase =
  "flex min-h-9 w-full items-center justify-center rounded-[4px] border border-[#414042] text-center font-semibold shadow-[0_1px_0_rgba(0,0,0,0.4)]";

function calculate(left: number, right: number, operator: Operator): number {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "×") return left * right;
  return right === 0 ? Number.NaN : left / right;
}

function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Number(value.toPrecision(10));
  const text = String(rounded);
  return text.length <= 12 ? text : rounded.toExponential(6);
}

function CalculatorButton({
  label,
  onKey,
}: {
  label: string;
  onKey: (label: string) => void;
}) {
  const number = /^[0-9.]$/.test(label);
  return (
    <button
      type="button"
      onClick={() => onKey(label)}
      className={`${buttonBase} ${
        number
          ? "bg-[#f5f5f5] text-[12pt] text-black"
          : "bg-[#de1f2a] text-[10pt] text-white"
      }`}
    >
      {label === "sqrt" ? "√" : label}
    </button>
  );
}

export function UcatCalculatorPreview({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [memory, setMemory] = useState(0);

  const handleKey = useCallback(
    (label: string) => {
      const current = display === "Error" ? 0 : Number(display);

      if (/^[0-9]$/.test(label)) {
        setDisplay((previous) => {
          if (waitingForOperand || previous === "0" || previous === "Error") {
            return label;
          }
          return previous.length >= 12 ? previous : `${previous}${label}`;
        });
        setWaitingForOperand(false);
        return;
      }

      if (label === ".") {
        setDisplay((previous) => {
          if (waitingForOperand || previous === "Error") return "0.";
          return previous.includes(".") ? previous : `${previous}.`;
        });
        setWaitingForOperand(false);
        return;
      }

      if (label === "ON/C") {
        setDisplay("0");
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(false);
        return;
      }

      if (label === "+/-") {
        setDisplay(formatDisplay(-current));
        return;
      }

      if (label === "sqrt") {
        setDisplay(
          formatDisplay(current < 0 ? Number.NaN : Math.sqrt(current)),
        );
        setWaitingForOperand(true);
        return;
      }

      if (label === "%") {
        setDisplay(formatDisplay(current / 100));
        setWaitingForOperand(true);
        return;
      }

      if (label === "MRC") {
        setDisplay(formatDisplay(memory));
        setWaitingForOperand(true);
        return;
      }

      if (label === "M+" || label === "M-") {
        setMemory((value) => value + current * (label === "M+" ? 1 : -1));
        setWaitingForOperand(true);
        return;
      }

      if (["+", "-", "×", "÷"].includes(label)) {
        const nextOperator = label as Operator;
        if (storedValue != null && operator && !waitingForOperand) {
          const result = calculate(storedValue, current, operator);
          setDisplay(formatDisplay(result));
          setStoredValue(result);
        } else {
          setStoredValue(current);
        }
        setOperator(nextOperator);
        setWaitingForOperand(true);
        return;
      }

      if (label === "=" && storedValue != null && operator) {
        const result = calculate(storedValue, current, operator);
        setDisplay(formatDisplay(result));
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(true);
      }
    },
    [display, memory, operator, storedValue, waitingForOperand],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const keyMap: Record<string, string> = {
        "*": "×",
        "/": "÷",
        Enter: "=",
        "=": "=",
        Backspace: "ON/C",
        Delete: "ON/C",
      };
      const label = /^[0-9.+\-%]$/.test(event.key)
        ? event.key
        : keyMap[event.key];
      if (!label) return;
      event.preventDefault();
      handleKey(label);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  return (
    <div className="pointer-events-auto absolute right-3 top-20 z-40 max-h-[calc(100%-5.5rem)] overflow-y-auto">
      <UcatFloatingPanel
        title="Calculator"
        titleIcon={<Calculator className="size-5" />}
        onClose={onClose}
        className="w-[min(280px,calc(100vw-2rem))]"
      >
        <div className="rounded-[12px] border border-black/60 bg-[#507abd] px-3 pb-4 pt-5 shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
          <div className="mb-3 min-h-7 rounded-[3px] border border-[#e4e5e6] bg-[#c5cebd] px-2 pt-1 text-right font-mono text-[20px] leading-none text-black shadow-inner">
            {display}
          </div>
          <div className="mb-3 flex items-center justify-center gap-1 text-[9px] font-semibold tracking-wide text-white">
            <Sigma className="size-3" />
            <span>Texas Instruments TI-108</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {rows.flat().map((label) => (
              <CalculatorButton key={label} label={label} onKey={handleKey} />
            ))}
            {["1", "2", "3"].map((label) => (
              <CalculatorButton key={label} label={label} onKey={handleKey} />
            ))}
            <button
              type="button"
              onClick={() => handleKey("=")}
              className={`${buttonBase} col-start-4 row-start-5 row-span-2 bg-[#de1f2a] text-[10pt] text-white`}
            >
              =
            </button>
            {["ON/C", "0", "."].map((label) => (
              <CalculatorButton key={label} label={label} onKey={handleKey} />
            ))}
          </div>
        </div>
      </UcatFloatingPanel>
    </div>
  );
}
