import type { IconName } from "@/components/app-icon";
export const learningSections: {
  number: number;
  title: string;
  icon: IconName;
}[] = [
  { number: 0, title: "General learning", icon: "book" },
  { number: 1, title: "Verbal Reasoning", icon: "book" },
  { number: 2, title: "Decision Making", icon: "brain" },
  { number: 3, title: "Quantitative Reasoning", icon: "numbers" },
  { number: 4, title: "Situational Judgement", icon: "people" },
];
export function moduleIcon(key: string | null): IconName {
  if (!key) return "book";
  if (/brain|puzzle|network|git|workflow|lightbulb/.test(key)) return "brain";
  if (/calculator|percent|sigma|pi|hash|binary|ruler|chart|table/.test(key))
    return "numbers";
  if (/user|heart|shield|scale|hand/.test(key)) return "people";
  if (/timer|clock|gauge|hourglass/.test(key)) return "timer";
  if (/pencil|pen|notebook/.test(key)) return "pencil";
  if (/layers|grid|boxes|clipboard|list/.test(key)) return "stack";
  if (key === "flag") return "flag";
  return "book";
}
