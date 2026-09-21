import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { IconName } from "@/components/app-icon";
export type Trainer = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  section_name: string;
  section_number: number;
  sort_order: number;
  time_limit_seconds: number;
  streak_enabled: boolean;
};
export function useTrainers() {
  return useQuery({
    queryKey: ["trainers"],
    queryFn: () => api<{ trainers: Trainer[] }>("/skill-trainers"),
  });
}
export const trainerIcons: Record<string, IconName> = {
  find_word: "book",
  find_concept: "book",
  quick_syllogism: "brain",
  mental_maths: "numbers",
  calculator_maths: "numbers",
  numpad_speed: "numbers",
};
export const instructions: Record<string, string[]> = {
  find_word: [
    "Read the passage, then choose a keyword from the bottom tray.",
    "Tap its matching word in the passage, or drag the keyword onto it.",
    "Place every keyword to move to the next passage. Incorrect placements cost points.",
  ],
  find_concept: [
    "Read the passage and find the concept shown.",
    "Tap each word that expresses the concept.",
    "Find all occurrences to continue. Incorrect taps and skips cost points.",
  ],
  quick_syllogism: [
    "Read the logic statements and the proposed conclusion.",
    "Tap Yes if the conclusion follows from the statements; otherwise tap No.",
    "Correct answers build your streak. Incorrect answers reset it.",
  ],
  mental_maths: [
    "Solve each question mentally.",
    "Enter your answer using the number pad, then tap Submit.",
    "Work quickly and accurately to build your score and streak.",
  ],
  calculator_maths: [
    "Use the calculator button in the toolbar to work out each question.",
    "Enter the final answer with the number pad, then tap Submit.",
    "Correct answers build your streak; incorrect answers cost points.",
  ],
  numpad_speed: [
    "Match the target key sequence using the calculator keys.",
    "Press the keys in order, then tap Submit sequence.",
    "Speed and accuracy earn points. Use Clear sequence to start the current sequence again.",
  ],
};
