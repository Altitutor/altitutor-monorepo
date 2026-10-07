"use client";
import { ShortcutKeys } from "@/shared/shortcuts/ShortcutKeys";
import { panelShortcut } from "@/shared/shortcuts/registry";
import { useState } from "react";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@altitutor/ui";
import { Plus } from "lucide-react";
import {
  useAccessoryPanel,
  type AccessoryKind,
  type AccessoryDestination,
} from "@/shared/contexts/AccessoryPanelContext";
import { useEntitySearch } from "@/shared/hooks/useEntitySearch";
import {
  useConversationList,
  useUnreadConversationCount,
} from "@/features/messages/api/queries";
import { formatContactName } from "@/features/messages/utils/formatContactName";
import { isContactConversation } from "@/features/messages/types";
import { AccessoryIcon } from "./AccessoryIcon";
import { accessoryRootViews } from "./AccessoryRootViews";
import { MessageUnreadBadge } from "@/features/messages/components/MessageUnreadBadge";
export function AccessoryTabPicker() {
  const panel = useAccessoryPanel();
  const { data: unreadCount = 0 } = useUnreadConversationCount();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { results, isLoading, hasError } = useEntitySearch({
    search,
    enabled: open,
    types: ["tasks", "issues", "projects", "notes"],
    excludeCompleted: true,
  });
  const {
    data: conversations,
    isLoading: conversationsLoading,
    isError: conversationsError,
  } = useConversationList(undefined, { enabled: open });
  const choose = (tab: AccessoryDestination) => {
    panel?.openTab(tab);
    setOpen(false);
    setSearch("");
  };
  const term = search.trim().toLowerCase();
  const matchingViews = accessoryRootViews.filter((view) =>
    view.title.toLowerCase().includes(term),
  );
  const recentTabs = (panel?.recentlyClosed ?? []).filter((tab) =>
    tab.title.toLowerCase().includes(term),
  );
  const records =
    term.length >= 2
      ? results.flatMap((result) => {
          const kind: AccessoryKind | null =
            result.type === "task"
              ? "task"
              : result.type === "issue"
                ? "issue"
                : result.type === "project"
                  ? "project"
                  : result.type === "note"
                    ? "document"
                    : null;
          const data = result.data as {
            title?: string | null;
            name?: string | null;
            status?: string | null;
          };
          if (
            !kind ||
            (["task", "issue", "project"].includes(kind) &&
              ["done", "completed", "resolved"].includes(data.status ?? ""))
          )
            return [];
          return [
            { kind, id: result.id, title: data.title ?? data.name ?? kind },
          ];
        })
      : [];
  const matchingConversations =
    term.length >= 2
      ? (conversations ?? [])
          .filter((item) => {
            const title = isContactConversation(item)
              ? formatContactName({ contacts: item.contact })
              : (item.groupName ?? "Group conversation");
            return (
              title.toLowerCase().includes(term) ||
              (!isContactConversation(item) &&
                item.participantNames.some((name) =>
                  name.toLowerCase().includes(term),
                ))
            );
          })
          .slice(0, 12)
      : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Add accessory tab"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(380px,calc(100vw-24px))] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search views, conversations, tasks…"
          />
          <CommandList>
            {matchingViews.length > 0 && (
              <CommandGroup heading="Views">
                {matchingViews.map((view) => (
                  <CommandItem
                    key={view.kind}
                    value={`view:${view.kind}`}
                    onSelect={() => choose(view)}
                  >
                    <AccessoryIcon
                      kind={view.kind}
                      className="mr-2 h-4 w-4 shrink-0"
                    />
                    {view.title}
                    {view.kind === "messages" && (
                      <MessageUnreadBadge
                        count={unreadCount}
                        className="ml-2"
                      />
                    )}
                    {panelShortcut(view.kind) && (
                      <ShortcutKeys id={panelShortcut(view.kind)!} always />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {recentTabs.length > 0 && (
              <CommandGroup heading="Recently closed">
                {recentTabs.map((tab) => (
                  <CommandItem
                    key={tab.key}
                    value={`recent:${tab.key}`}
                    onSelect={() => choose(tab)}
                  >
                    <AccessoryIcon
                      kind={tab.kind}
                      className="mr-2 h-4 w-4 shrink-0"
                    />
                    <span className="truncate">{tab.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {records.length > 0 && (
              <CommandGroup heading="Records">
                {records.map((record) => (
                  <CommandItem
                    key={`${record.kind}:${record.id}`}
                    value={`${record.kind}:${record.id}`}
                    onSelect={() => choose(record)}
                  >
                    <AccessoryIcon
                      kind={record.kind}
                      className="mr-2 h-4 w-4 shrink-0"
                    />
                    <span className="mr-2 text-xs text-muted-foreground">
                      {record.kind}
                    </span>
                    {record.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {matchingConversations.length > 0 && (
              <CommandGroup heading="Conversations">
                {matchingConversations.map((item) => {
                  const contact = isContactConversation(item);
                  const id = contact ? item.contactId : item.conversationId;
                  const title = contact
                    ? formatContactName({ contacts: item.contact })
                    : (item.groupName ?? "Group conversation");
                  return (
                    <CommandItem
                      key={`messages:${id}`}
                      value={`messages:${id}`}
                      onSelect={() =>
                        choose({
                          kind: "messages",
                          id,
                          title,
                          query: `${contact ? "contact" : "group"}=${encodeURIComponent(id)}`,
                        })
                      }
                    >
                      <AccessoryIcon
                        kind="messages"
                        className="mr-2 h-4 w-4 shrink-0"
                      />
                      {title}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {!matchingViews.length &&
              !recentTabs.length &&
              !records.length &&
              !matchingConversations.length &&
              !isLoading &&
              !conversationsLoading &&
              !hasError &&
              !conversationsError && (
                <p className="p-3 text-sm text-muted-foreground">
                  No results found.
                </p>
              )}
            {(isLoading || conversationsLoading) && (
              <p className="p-3 text-sm text-muted-foreground">Searching…</p>
            )}
            {(hasError || conversationsError) && (
              <p className="p-3 text-sm text-destructive">
                Some results could not load. Try again.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
