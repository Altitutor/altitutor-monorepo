export type ConversationListQueryFields = {
  names: string[];
  phones: string[];
  unread: boolean;
  unreplied: boolean;
  followUp: boolean;
  assignedStaffId: string | null;
  recipientType: string | null;
  ownedNumberIds: string[];
};

export type ConversationListQuery = {
  search: string;
  filters: Record<string, unknown[]>;
  staffId: string | null;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizePhone(phone: string): string {
  const value = digits(phone);
  if (value.startsWith("61") && value.length >= 10) return `0${value.slice(2)}`;
  if (value.length === 9 && !value.startsWith("0")) return `0${value}`;
  return value;
}

function selected(filters: Record<string, unknown[]>, key: string): string[] {
  return (filters[key] ?? []).filter((value): value is string => typeof value === "string");
}

function matchesAny(selectedValues: string[], matches: (value: string) => boolean): boolean {
  return selectedValues.length === 0 || selectedValues.some(matches);
}

export function matchesConversationListQuery(
  fields: ConversationListQueryFields,
  query: ConversationListQuery,
): boolean {
  const search = query.search.trim().toLowerCase();
  if (search) {
    const normalizedSearch = normalizePhone(search);
    const nameMatch = fields.names.some((name) => name.toLowerCase().includes(search));
    const phoneMatch = fields.phones.some((phone) => {
      const normalized = normalizePhone(phone);
      return phone.toLowerCase().includes(search) || (normalizedSearch.length > 0 && normalized.includes(normalizedSearch));
    });
    if (!nameMatch && !phoneMatch) return false;
  }

  const { filters } = query;
  if (!matchesAny(selected(filters, "read"), (value) => (value === "unread" ? fields.unread : !fields.unread))) return false;
  if (!matchesAny(selected(filters, "reply"), (value) => (value === "unreplied" ? fields.unreplied : !fields.unreplied))) return false;
  if (selected(filters, "followUp").includes("yes") && !fields.followUp) return false;
  if (!matchesAny(selected(filters, "assignee"), (value) => value === "mine" && query.staffId != null && fields.assignedStaffId === query.staffId)) return false;
  if (!matchesAny(selected(filters, "recipient"), (value) => fields.recipientType === value)) return false;
  if (!matchesAny(selected(filters, "from"), (value) => fields.ownedNumberIds.includes(value))) return false;
  return true;
}
