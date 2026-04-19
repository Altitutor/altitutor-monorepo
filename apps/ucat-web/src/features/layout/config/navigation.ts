import type { ComponentType } from "react";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  NotebookText,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** When true, sidebar renders this as expandable with dynamic children (e.g. Progress) */
  expandable?: boolean;
};

export type NavSection = {
  /**
   * Optional section heading shown above the items (e.g. "LEARN").
   * If omitted, items are rendered without a heading (used for Dashboard).
   */
  title?: string;
  items: NavItem[];
};

/** Primary nav (scrollable). Settings lives in {@link appNavigationFooter}. */
export const appNavigation: NavSection[] = [
  {
    // Top-level dashboard entry, no heading
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/progress",
        label: "Progress",
        icon: TrendingUp,
        expandable: true,
      },
    ],
  },
  {
    title: "LEARN",
    items: [
      { href: "/learn", label: "Learn", icon: BookOpen },
      { href: "/sessions", label: "Sessions", icon: CalendarDays },
    ],
  },
  {
    title: "PRACTICE",
    items: [
      { href: "/practice", label: "Practice", icon: BrainCircuit },
      { href: "/skill-trainer", label: "Skill trainer", icon: Target },
    ],
  },
  {
    title: "SIMULATE",
    items: [
      { href: "/sets", label: "Sets", icon: ListChecks, expandable: true },
      { href: "/mocks", label: "Mocks", icon: NotebookText },
    ],
  },
];

/** Pinned to the bottom of the sidebar below the scrollable main nav. */
export const appNavigationFooter: NavSection = {
  items: [{ href: "/settings", label: "Settings", icon: Settings }],
};
