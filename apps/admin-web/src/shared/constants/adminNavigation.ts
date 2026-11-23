import {
  Users,
  Calendar,
  FileText,
  Home,
  CreditCard,
  MessageSquareText,
  Mail,
  ListTodo,
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
  { title: "Home", href: "/dashboard", icon: Home },
  {
    title: "Calendar",
    href: "/sessions",
    icon: Calendar,
    children: [
      { title: "Sessions", href: "/sessions" },
      { title: "Classes", href: "/classes" },
    ],
  },
  { title: "Messages", href: "/messages", icon: MessageSquareText },
  { title: "Email", href: "/email", icon: Mail },
  {
    title: "Files",
    href: "/subjects",
    icon: FileText,
    children: [
      { title: "Subjects", href: "/subjects" },
      { title: "Documents", href: "/documents" },
    ],
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListTodo,
    children: [
      { title: "Tasks", href: "/tasks" },
      { title: "Projects", href: "/projects" },
      { title: "Issues", href: "/issues" },
    ],
  },
  {
    title: "People",
    href: "/students",
    icon: Users,
    children: [
      { title: "Students", href: "/students" },
      { title: "Parents", href: "/parents" },
      { title: "Staff", href: "/staff" },
    ],
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    children: [
      { title: "All invoices", href: "/billing/invoices" },
      { title: "To invoice", href: "/billing/to-invoice" },
      { title: "Adjustments", href: "/billing/adjustments" },
    ],
  },
  { title: "Reports", href: "/reports", icon: FileText },
];
