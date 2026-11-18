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
  actionState?: {
    deleted?: boolean;
    emailMessageId?: string;
    emailActionAvailable?: boolean;
    accountLabel?: string;
    accountAvailable?: boolean;
    sessionType?: string;
    hasPaymentPage?: boolean;
    hasStripeInvoice?: boolean;
    hasPdf?: boolean;
    message?: { hasImessage: boolean; own: boolean; sentAt: string | null; createdAt: string | null };
  };
  destination?: {
    kind: "email" | "messages";
    id: string;
    query: string;
    title: string;
  };
};
