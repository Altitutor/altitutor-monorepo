export type ReferencePerson = {
  role: "Student" | "Staff";
  id: string;
  name: string;
  plannedStatus: string;
  actualAttended?: boolean | null;
};

export type ReferenceDetails = {
  title: string;
  href?: string;
  status?: string | null;
  fields: Array<{ label: string; value: string }>;
  people?: ReferencePerson[];
  logged?: boolean;
  destination?: {
    kind: "email" | "messages";
    id: string;
    query: string;
    title: string;
  };
};
