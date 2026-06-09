import type { UcatSkillTrainerKey } from "@altitutor/shared";

export const SKILL_TRAINER_INSTRUCTIONS: Record<UcatSkillTrainerKey, string[]> = {
  find_word: [
    "Read the passage on the left. Keywords appear at the top of the right column.",
    "Click a keyword, then click the sentence where it appears (or drag it there).",
    "Place every keyword correctly to advance to the next passage.",
    "Wrong placements trigger a short cooldown before you can try again.",
  ],
  find_concept: [
    "Read the passage on the left. The concept to find is shown on the right.",
    "Click every place the concept appears in the passage, then press Submit.",
    "Mis-clicks or submitting too early trigger a short cooldown.",
  ],
  quick_syllogism: [
    "Read the statement, then drag Yes or No into the answer box.",
    "Your answer submits automatically when you drop it in.",
    "Correct answers build your streak for bonus points; wrong answers reset it.",
  ],
  mental_maths: [
    "Solve each maths question mentally and type your answer.",
    "Press Enter or Submit to move on. Harder questions are worth more points.",
    "Wrong answers cost points but there is no cooldown.",
  ],
  numpad_speed: [
    "The target button sequence is shown on the right. Use the calculator on the left.",
    "Press the matching keys in order. Press = or Enter to submit your sequence.",
    "Use Backspace to undo the last key. Sequences never include =.",
  ],
  calculator_maths: [
    "Read the question on the left. Use the embedded calculator on the right to work it out.",
    "Click the answer field at the bottom to type your final answer, then press Enter.",
    "Click back on the calculator to enter numbers there again.",
  ],
};
