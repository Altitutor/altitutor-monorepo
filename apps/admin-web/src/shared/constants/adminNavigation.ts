import {
  Users,
  Calendar,
  GraduationCap,
  FileText,
  Home,
  CreditCard,
  AlertTriangle,
  Beaker,
  ClipboardList,
  UserRound,
  MessageSquareText,
  Mail,
  ListTodo,
  FolderKanban,
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
  { title: "Messages", href: "/messages", icon: MessageSquareText },
  { title: "Mail", href: "/email", icon: Mail },
  {
    type: "heading",
    title: "SCHEDULING",
  },
  {
    title: "Students",
    href: "/students",
    icon: GraduationCap,
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
  { type: "heading", title: "OPERATIONS" },
  { title: "Tasks", href: "/tasks", icon: ListTodo },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Issues", href: "/issues", icon: AlertTriangle },
  { title: "Documents", href: "/documents", icon: FileText },
  {
    type: "heading",
    title: "FINANCIAL",
  },
  {
    title: "Invoices",
    href: "/billing",
    icon: CreditCard,
    children: [
      { title: "All invoices", href: "/billing/invoices" },
      { title: "To invoice", href: "/billing/to-invoice" },
      { title: "Adjustments", href: "/billing/adjustments" },
    ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
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
];
