import {
  Calendar,
  Mail,
  CheckSquare,
  AlertTriangle,
  GraduationCap,
  UserRound,
  Users,
  Beaker,
  FileText,
  File,
  FolderKanban,
  Newspaper,
  ClipboardList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const paletteEntities = {
  email: { label: "Email", icon: Mail },
  student: { label: "Students", icon: GraduationCap },
  parent: { label: "Parents", icon: UserRound },
  staff: { label: "Staff", icon: Users },
  subject: { label: "Subjects", icon: Beaker },
  class: { label: "Classes", icon: Calendar },
  session: { label: "Sessions", icon: ClipboardList },
  task: { label: "Tasks", icon: CheckSquare },
  project: { label: "Projects", icon: FolderKanban },
  issue: { label: "Issues", icon: AlertTriangle },
  note: { label: "Documents", icon: FileText },
  file: { label: "Files", icon: File },
  topic: { label: "Topics", icon: Newspaper },
} satisfies Record<string, { label: string; icon: LucideIcon }>;

export type PaletteEntityType = keyof typeof paletteEntities;
export const recordEntities = {
  ...paletteEntities,
  invoice: { label: "Invoices", icon: FileText },
  adminShift: { label: "Admin shifts", icon: Calendar },
  tutorLog: { label: "Tutor logs", icon: ClipboardList },
};
export type EntityTarget = {
  type: PaletteEntityType;
  id: string;
  title: string;
};
export type RecordTarget = Omit<EntityTarget, "type"> & {
  type: keyof typeof recordEntities;
};
export type PaletteEntity = EntityTarget & {
  subtitle?: string;
  parents?: EntityTarget[];
};
export type PaletteSearch = {
  type: PaletteEntityType;
  search: string;
  limit: number;
  offset?: number;
  subjectId?: string;
  topicId?: string;
};
export type PaletteSearchResult = {
  results: PaletteEntity[];
  hasMore: boolean;
};
export type SearchPaletteEntities = (
  search: PaletteSearch,
) => Promise<PaletteSearchResult>;
export type PaletteCommand = {
  id: string;
  title: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string[];
  target?: RecordTarget;
  parents?: string[];
  disabled?: boolean;
  destructive?: boolean;
};
