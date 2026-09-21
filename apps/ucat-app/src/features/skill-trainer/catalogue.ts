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
