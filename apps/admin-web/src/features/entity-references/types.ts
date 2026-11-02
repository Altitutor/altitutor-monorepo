export type ReferenceDetails = {
  title: string;
  href?: string;
  status?: string | null;
  fields: Array<{ label: string; value: string }>;
  destination?: {
    kind: "email" | "messages";
    id: string;
    query: string;
    title: string;
  };
};
