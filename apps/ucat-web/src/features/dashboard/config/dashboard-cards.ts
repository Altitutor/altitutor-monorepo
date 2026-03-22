import type { ComponentType } from "react";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ListChecks,
  NotebookText,
  Target,
} from "lucide-react";
import { isComingSoon } from "@/features/layout/config/coming-soon";

export type DashboardCard = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const cards: DashboardCard[] = [
  {
    href: "/learn",
    label: "Learn",
    description: "Study materials and resources for UCAT preparation",
    icon: BookOpen,
  },
  {
    href: "/sessions",
    label: "Sessions",
    description: "View and manage your tutoring sessions",
    icon: CalendarDays,
  },
  {
    href: "/skill-trainer",
    label: "Skill trainer",
    description: "Targeted drills to sharpen individual UCAT skills",
    icon: Target,
  },
  {
    href: "/practice",
    label: "Practice",
    description: "Practice questions and drills",
    icon: BrainCircuit,
  },
  {
    href: "/sets",
    label: "Sets",
    description: "Question sets by section and custom generators",
    icon: ListChecks,
  },
  {
    href: "/mocks",
    label: "Mocks",
    description: "Full-length mock exams",
    icon: NotebookText,
  },
];

export const dashboardCards = cards.map((card) => ({
  ...card,
  comingSoon: isComingSoon(card.href),
}));
