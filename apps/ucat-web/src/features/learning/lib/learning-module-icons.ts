import {
  BookOpen,
  Brain,
  Calculator,
  Compass,
  FileText,
  Lightbulb,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

const LEARNING_MODULE_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  target: Target,
  brain: Brain,
  calculator: Calculator,
  compass: Compass,
  sparkles: Sparkles,
  "file-text": FileText,
};

export function getLearningModuleIcon(iconKey: string | null): LucideIcon {
  return LEARNING_MODULE_ICONS[iconKey ?? ""] ?? BookOpen;
}
