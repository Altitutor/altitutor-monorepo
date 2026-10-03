"use client";
import { ShortcutKeys } from '@/shared/shortcuts/ShortcutKeys';
import { panelShortcut } from '@/shared/shortcuts/registry';
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
} from "@/shared/contexts/AccessoryPanelContext";
import { useEntitySearch } from "@/shared/hooks/useEntitySearch";
import { useConversationList } from "@/features/messages/api/queries";
import { formatContactName } from "@/features/messages/utils/formatContactName";
import { isContactConversation } from "@/features/messages/types";
import { AccessoryIcon } from "./AccessoryIcon";
const views: { kind: AccessoryKind; title: string }[] = [
  { kind: "today", title: "Today" },
  { kind: "messages", title: "Messages" },
  { kind: "tasks", title: "Tasks" },
  { kind: "issues", title: "Issues" },
  { kind: "projects", title: "Projects" },
  { kind: "documents", title: "Documents" },
];
export function AccessoryTabPicker() {
  const panel = useAccessoryPanel();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { results, isLoading, hasError } = useEntitySearch({
    search,
    enabled: open,
    types: ["tasks", "issues", "projects", "notes"],
  });
  const {
    data: conversations,
    isLoading: conversationsLoading,
    isError: conversationsError,
  } = useConversationList(undefined, { enabled: open });
  const choose = (tab: {
    kind: AccessoryKind;
    title: string;
    id?: string;
    query?: string;
  }) => {
    panel?.openTab(tab);
    setOpen(false);
    setSearch("");
  };
  const term = search.trim().toLowerCase();
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
            <CommandGroup heading="Views">
              {views
                .filter((view) => view.title.toLowerCase().includes(term))
                .map((view) => (
                  <CommandItem key={view.kind} onSelect={() => choose(view)}>
                    <AccessoryIcon
                      kind={view.kind}
                      className="mr-2 h-4 w-4 shrink-0"
                    />
                    {view.title}
                    {panelShortcut(view.kind) && <ShortcutKeys id={panelShortcut(view.kind)!} always />}
                  </CommandItem>
                ))}
            </CommandGroup>
            {term.length >= 2 && (
              <>
                <CommandGroup heading="Records">
                  {results.map((result) => {
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
                    if (!kind) return null;
                    const data = result.data as {
                      title?: string | null;
                      name?: string | null;
                    };
                    const title = data.title ?? data.name ?? kind;
                    return (
                      <CommandItem
                        key={`${kind}:${result.id}`}
                        value={`${kind}:${result.id}`}
                        onSelect={() => choose({ kind, id: result.id, title })}
                      >
                        <AccessoryIcon
                          kind={kind}
                          className="mr-2 h-4 w-4 shrink-0"
                        />
                        <span className="mr-2 text-xs text-muted-foreground">
                          {kind}
                        </span>
                        {title}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandGroup heading="Conversations">
                  {(conversations ?? [])
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
                    .map((item) => {
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
              </>
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
