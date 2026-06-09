"use client";

import { Sigma } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

const ROWS_1_4: string[][] = [
  ["+/-", "sqrt", "%", "÷"],
  ["MRC", "M-", "M+", "×"],
  ["7", "8", "9", "-"],
  ["4", "5", "6", "+"],
];
const ROW_5_LEFT = ["1", "2", "3"];
const ROW_6_LEFT = ["ON/C", "0", "."];

const BUTTON_BASE =
  "flex min-h-[36px] w-full items-center justify-center rounded-[4px] border border-[#414042] text-center font-semibold shadow-[0_1px_0_rgba(0,0,0,0.4)]";

function CalcButton({
  label,
  onKey,
  highlighted,
}: {
  label: string;
  onKey: (label: string) => void;
  highlighted?: boolean;
}) {
  const isNumberOrDot = /^[0-9.]$/.test(label);
  const variant = isNumberOrDot
    ? "bg-[#F5F5F5] text-black text-[12pt]"
    : "bg-[#DE1F2A] text-white text-[10pt]";
  return (
    <button
      type="button"
      onClick={() => onKey(label)}
      className={`${BUTTON_BASE} ${variant} ${highlighted ? "ring-2 ring-primary ring-offset-1" : ""}`}
    >
      {label === "sqrt" ? "√" : label}
    </button>
  );
}

export function EmbeddedCalculator({
  display,
  onKey,
  active = true,
  onEquals,
  showDisplay = true,
  captureKeyboardAlways = false,
}: {
  display: string;
  onKey: (label: string) => void;
  active?: boolean;
  /** When set, = triggers this instead of a normal calc key press */
  onEquals?: () => void;
  /** Hide the LCD display (numpad speed mode). */
  showDisplay?: boolean;
  /** Capture keyboard even when focus is on document.body (numpad speed). */
  captureKeyboardAlways?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback(
    (label: string) => {
      if (label === "=" && onEquals) {
        onEquals();
        return;
      }
      onKey(label);
    },
    [onEquals, onKey],
  );

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusOk =
        captureKeyboardAlways ||
        rootRef.current?.contains(document.activeElement) ||
        document.activeElement === document.body;
      if (!focusOk) return;

      if (event.altKey || event.metaKey || event.ctrlKey) return;

      let label: string | null = null;
      if (/^[0-9]$/.test(event.key)) {
        label = event.key;
      } else {
        const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        switch (k) {
          case "c":
            label = "MRC";
            break;
          case "p":
            label = "M+";
            break;
          case "m":
            label = "M-";
            break;
          case ".":
            label = ".";
            break;
          case "+":
            label = "+";
            break;
          case "-":
            label = "-";
            break;
          case "*":
          case "x":
            label = "×";
            break;
          case "/":
            label = "÷";
            break;
          case "%":
            label = "%";
            break;
          case "enter":
          case "=":
            label = "=";
            break;
          case "backspace":
            event.preventDefault();
            return;
          default:
            break;
        }
      }

      if (!label) return;
      event.preventDefault();
      handleKey(label);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [active, captureKeyboardAlways, handleKey]);

  return (
    <div
      ref={rootRef}
      tabIndex={active ? 0 : -1}
      className={`rounded-[12px] border border-black/60 bg-[#507ABD] px-3 pb-4 pt-5 shadow-[0_2px_4px_rgba(0,0,0,0.6)] outline-none ${
        active ? "ring-2 ring-primary/40" : "opacity-90"
      }`}
      onClick={() => rootRef.current?.focus()}
    >
      {showDisplay ? (
        <div className="mb-3 rounded-[3px] border border-[#E4E5E6] bg-[#C5CEBD] px-2 pt-1 text-right font-mono text-[20px] leading-none text-black shadow-inner">
          {display}
        </div>
      ) : null}
      <div
        className={`flex items-center justify-center gap-1 text-[9px] font-semibold tracking-wide text-white ${
          showDisplay ? "mb-3" : "mb-2"
        }`}
      >
        <Sigma className="h-3 w-3" />
        <span>Texas Instruments TI-108</span>
      </div>
      <div
        className="grid grid-cols-4 gap-1.5 text-[12pt]"
        style={{ gridAutoRows: "minmax(36px, 1fr)" }}
      >
        {ROWS_1_4.flat().map((label) => (
          <CalcButton key={label} label={label} onKey={handleKey} highlighted={active} />
        ))}
        {ROW_5_LEFT.map((label) => (
          <CalcButton key={label} label={label} onKey={handleKey} highlighted={active} />
        ))}
        <button
          type="button"
          onClick={() => handleKey("=")}
          className={`col-start-4 row-start-5 row-span-2 min-h-0 ${BUTTON_BASE} bg-[#DE1F2A] text-[10pt] font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.4)] ${
            active ? "ring-2 ring-primary ring-offset-1" : ""
          }`}
        >
          =
        </button>
        {ROW_6_LEFT.map((label) => (
          <CalcButton key={label} label={label} onKey={handleKey} highlighted={active} />
        ))}
      </div>
    </div>
  );
}
