import type { DataTableState } from "@altitutor/shared";
import type { Journey, nextActions } from "@/features/onboarding/lib/model";
import type {
  OnlineProductRelationshipSummary,
  StudentMinimalListRow,
  StudentSearchField,
} from "../api/students";

export type StudentDirectoryEntry = {
  id: string;
  label: string;
  journey?: Journey;
  stage: string | null;
  online_since: string | null;
  products: OnlineProductRelationshipSummary[];
  actions: ReturnType<typeof nextActions>;
} & (
  | { kind: "student"; student: StudentMinimalListRow }
  | { kind: "enquiry"; student: null }
);
export type StudentDirectoryPage = {
  entries: StudentDirectoryEntry[];
  total: number;
  deadlines: Record<string, number>;
};
export type StudentDirectoryRequest = Pick<
  DataTableState,
  | "search"
  | "filters"
  | "sortBy"
  | "sortDirection"
  | "page"
  | "pageSize"
  | "groupBy"
> & { searchFields: StudentSearchField[] };
