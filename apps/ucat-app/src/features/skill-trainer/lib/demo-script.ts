import type { UcatSkillTrainerKey } from "@altitutor/shared";

export type DemoStep = {
  caption: string;
  target?: string;
  pressed?: boolean;
  typed?: string;
  activeKey?: string;
  durationMs?: number;
  draggingChoice?: "yes" | "no";
  droppedChoice?: "yes" | "no";
};

function calculatorKeySteps(
  prefix: string,
  entries: { key: string; typed: string }[],
): DemoStep[] {
  return entries.flatMap(({ key, typed }) => {
    const target = `${prefix}${key === "+" ? "plus" : key}`;
    return [
      {
        caption: "Enter the whole sequence in order.",
        target,
        durationMs: 450,
      },
      {
        caption: "Enter the whole sequence in order.",
        target,
        pressed: true,
        typed,
        activeKey: key,
        durationMs: 350,
      },
    ];
  });
}

export const DEMO_STEPS: Record<UcatSkillTrainerKey, DemoStep[]> = {
  find_word: [
    { caption: "Select a keyword.", target: "keyword" },
    { caption: "Select a keyword.", target: "keyword", pressed: true },
    { caption: "Find the same word in the passage.", target: "passage-word" },
    {
      caption: "Tap the matching word to place it.",
      target: "passage-word",
      pressed: true,
    },
    {
      caption: "The correctly placed word is confirmed.",
      target: "passage-word",
    },
  ],
  find_concept: [
    {
      caption: "Read the concept, then find every occurrence.",
      target: "concept",
    },
    {
      caption: "Tap the first occurrence.",
      target: "concept-one",
    },
    {
      caption: "Tap the first occurrence.",
      target: "concept-one",
      pressed: true,
    },
    { caption: "Continue looking through the passage.", target: "concept-two" },
    {
      caption: "Tap the next occurrence.",
      target: "concept-two",
      pressed: true,
    },
    {
      caption: "Continue until every occurrence is selected.",
      target: "concept",
    },
  ],
  quick_syllogism: [
    { caption: "Read the premises and conclusion.", target: "syllogism" },
    {
      caption: "Drag Yes or No into the answer box.",
      target: "yes-answer",
      durationMs: 700,
    },
    {
      caption: "Drag Yes or No into the answer box.",
      target: "yes-answer",
      pressed: true,
      draggingChoice: "yes",
      durationMs: 400,
    },
    {
      caption: "Drag Yes or No into the answer box.",
      target: "drop-box",
      pressed: true,
      draggingChoice: "yes",
      durationMs: 900,
    },
    {
      caption: "Drop to submit your answer.",
      target: "drop-box",
      droppedChoice: "yes",
      durationMs: 650,
    },
    {
      caption: "The next syllogism appears automatically.",
      target: "syllogism",
      droppedChoice: "yes",
    },
  ],
  mental_maths: [
    { caption: "Work out the answer mentally.", target: "mental-question" },
    {
      caption: "Tap the answer field.",
      target: "mental-answer",
      pressed: true,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "1",
      durationMs: 300,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "12",
      durationMs: 300,
    },
    {
      caption: "Type the answer.",
      target: "mental-answer",
      typed: "126",
      durationMs: 450,
    },
    { caption: "Select Submit to move on.", target: "mental-submit" },
    {
      caption: "Select Submit to move on.",
      target: "mental-submit",
      pressed: true,
    },
  ],
  calculator_maths: [
    {
      caption: "Tap the question area to begin.",
      target: "calculator-question",
      pressed: true,
    },
    {
      caption: "Tap the calculator to switch focus.",
      target: "calculator-display",
      durationMs: 600,
    },
    {
      caption: "Tap the calculator to switch focus.",
      target: "calculator-display",
      pressed: true,
      durationMs: 400,
    },
    ...calculatorKeySteps("calculator-", [
      { key: "2", typed: "2" },
      { key: "4", typed: "24" },
      { key: "+", typed: "24+" },
      { key: "1", typed: "24+1" },
      { key: "2", typed: "24+12" },
    ]).map((step) => ({
      ...step,
      caption: "Type the calculation using the calculator.",
    })),
    {
      caption: "Enter the final answer below the question.",
      target: "calculator-answer",
      typed: "3",
      durationMs: 300,
    },
    {
      caption: "Enter the final answer below the question.",
      target: "calculator-answer",
      typed: "36",
      durationMs: 450,
    },
    { caption: "Select Submit to move on.", target: "calculator-submit" },
    {
      caption: "Select Submit to move on.",
      target: "calculator-submit",
      pressed: true,
    },
  ],
  numpad_speed: [
    {
      caption: "Read the target sum from left to right.",
      target: "numpad-target",
    },
    ...calculatorKeySteps("numpad-", [
      { key: "2", typed: "2" },
      { key: "3", typed: "23" },
      { key: "+", typed: "23+" },
      { key: "4", typed: "23+4" },
    ]),
    {
      caption: "Select Submit when the sequence is complete.",
      target: "numpad-submit",
    },
    {
      caption: "Select Submit when the sequence is complete.",
      target: "numpad-submit",
      pressed: true,
    },
  ],
};

export function latestDemoTyped(
  steps: readonly DemoStep[],
  stepIndex: number,
  pick: (step: DemoStep) => boolean,
): string {
  const end = Math.min(Math.max(stepIndex, 0), steps.length - 1);
  for (let i = end; i >= 0; i -= 1) {
    const step = steps[i];
    if (pick(step) && step.typed !== undefined) return step.typed;
  }
  return "";
}
