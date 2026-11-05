import { encodeViewConfig, type DisplaySettings, type QuickFilter } from "@altitutor/shared";

export const CONVERSATION_LIST_COLUMNS = ["avatar", "name", "sender", "preview", "timestamp"] as const;

export const conversationListDefaults: DisplaySettings = {
  filters: {},
  sortBy: "latest",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: [...CONVERSATION_LIST_COLUMNS],
};

function view(id: string, name: string, filters: Record<string, unknown[]>): QuickFilter {
  return {
    id: `builtin:messages:${id}`,
    name,
    user_id: null,
    target_entity: "messages",
    created_at: "",
    updated_at: "",
    config: encodeViewConfig({ ...conversationListDefaults, filters }),
  };
}

export const conversationListViews: QuickFilter[] = [
  view("all", "All", {}),
  view("unread", "Unread", { read: ["unread"] }),
  view("mine", "Assigned to me", { assignee: ["mine"] }),
  view("unreplied", "Unreplied", { reply: ["unreplied"] }),
  view("follow-up", "To follow up", { followUp: ["yes"] }),
];
