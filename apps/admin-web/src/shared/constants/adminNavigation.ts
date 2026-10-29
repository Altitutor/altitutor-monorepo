import {
  Users,
  Calendar,
  GraduationCap,
  FileText,
  Home,
  CreditCard,
  AlertTriangle,
  Beaker,
  Newspaper,
  ClipboardList,
  Monitor,
  UserRound,
  TrendingUp,
  MessageSquareText,
  Mail,
  type LucideIcon,
} from "lucide-react";

export type NavItem =
  | {
      type?: "link";
      title: string;
      href: string;
      icon: LucideIcon;
      children?: { title: string; href: string }[];
    }
  | { type: "heading"; title: string };

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    type: "heading",
    title: "COMMUNICATION",
  },
  { title: "Mail", href: "/email", icon: Mail },
  {
    title: "Feedback",
    href: "/feedback",
    icon: MessageSquareText,
  },
  {
    title: "Trial students",
    href: "/trial-students",
    icon: Users,
    children: [
      { title: "Work queue", href: "/trial-students" },
      { title: "Conversion insights", href: "/trial-students/insights" },
    ],
  },
  {
    type: "heading",
    title: "SCHEDULING",
  },
  {
    title: "In-person Students",
    href: "/students",
    icon: GraduationCap,
  },
  {
    title: "Online Students",
    href: "/online-students",
    icon: Monitor,
  },
  {
    title: "Parents",
    href: "/parents",
    icon: UserRound,
  },
  {
    title: "Staff",
    href: "/staff",
    icon: Users,
  },
  {
    title: "Classes",
    href: "/classes",
    icon: Calendar,
  },
  {
    title: "Sessions",
    href: "/sessions",
    icon: ClipboardList,
  },
  {
    type: "heading",
    title: "FINANCIAL",
  },
  {
    title: "Reconciliation",
    href: "/reconciliation",
    icon: AlertTriangle,
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: CreditCard,
  },
  {
    title: "Subsidies",
    href: "/subsidies",
    icon: CreditCard,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    title: "Tutor logs",
    href: "/tutor-logs",
    icon: ClipboardList,
  },
  {
    title: "Pay tiers",
    href: "/pay-tiers",
    icon: TrendingUp,
  },
  {
    type: "heading",
    title: "RESOURCES",
  },
  {
    title: "Subjects",
    href: "/subjects",
    icon: Beaker,
  },
  {
    title: "Topics",
    href: "/topics",
    icon: Newspaper,
  },
];
