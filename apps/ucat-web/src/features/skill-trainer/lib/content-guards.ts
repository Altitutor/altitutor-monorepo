import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
} from "@altitutor/shared";

export function asFindWordContent(raw: unknown): FindWordItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as FindWordItemContent;
  if (!c.passage || !Array.isArray(c.keywords)) return null;
  return c;
}

export function asFindConceptContent(raw: unknown): FindConceptItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as FindConceptItemContent;
  if (!c.passage || !Array.isArray(c.occurrences) || typeof c.concept !== "string") return null;
  return c;
}

export function asQuickSyllogismContent(raw: unknown): QuickSyllogismItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as QuickSyllogismItemContent;
  if (typeof c.statement !== "string" || typeof c.answer !== "boolean") return null;
  return c;
}

export function asMentalMathsContent(raw: unknown): MentalMathsItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as MentalMathsItemContent;
  if (typeof c.expression !== "string" || typeof c.answer !== "number") return null;
  return c;
}

export function asNumpadSpeedContent(raw: unknown): NumpadSpeedItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as NumpadSpeedItemContent;
  if (!Array.isArray(c.button_sequence)) return null;
  return c;
}

export function asCalculatorMathsContent(raw: unknown): CalculatorMathsItemContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as CalculatorMathsItemContent;
  if (typeof c.answer !== "number") return null;
  if (!c.expression && !c.question) return null;
  return c;
}
