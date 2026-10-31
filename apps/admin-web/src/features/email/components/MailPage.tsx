"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import {
  Button,
  DataTableToolbar,
  Skeleton,
  TablePagination,
} from "@altitutor/ui";
import {
  encodeViewConfig,
  readViewSettings,
  type DisplaySettings,
  type QuickFilter,
} from "@altitutor/shared";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";
import { useRegisterPageActions } from "@/features/command-palette/RecordActionsContext";
import { useMailbox, useSyncMailbox } from "../api/client";
import {
  useComposeEmail,
  useOpenEmailThread,
} from "../hooks/useOpenEmailThread";
import type { EmailSummary } from "../types";
import { EmailIconButton } from "./EmailIconButton";
import { EmailActions } from "./EmailActions";
import { MailFolders, emailDragType } from "./MailFolders";
const defaults: DisplaySettings = {
  filters: {},
  sortBy: "received",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: ["time", "preview"],
};
export function MailPage() {
  const [folder, setFolder] = useState<string>();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [settings, setSettings] = useState(defaults);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const mailbox = useMailbox({
    folder,
    search: term,
    assignee: settings.filters.assignee?.map(String).join(",") || "all",
    offset,
    sort: settings.sortBy ?? "received",
    direction: settings.sortDirection,
  });
  const sync = useSyncMailbox();
  const syncBusy = useRef(false);
  const openThread = useOpenEmailThread();
  const compose = useComposeEmail();
  const savedViews = useQuickFilters("email");
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (folder === undefined && mailbox.data)
      setFolder(
        mailbox.data.folders.find((item) => item.role === "inbox")?.id ?? "",
      );
  }, [folder, mailbox.data]);
  const configured = mailbox.data?.configured;
  const syncNow = sync.mutateAsync;
  useEffect(() => {
    if (!configured) return;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || syncBusy.current) return;
      syncBusy.current = true;
      try {
        await syncNow();
      } catch {
        /* Cached mailbox remains readable. */
      } finally {
        syncBusy.current = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [configured, syncNow]);
  const views = useMemo<QuickFilter[]>(
    () =>
      [
        {
          id: "builtin:email:all",
          name: "All",
          config: encodeViewConfig(defaults),
        },
        {
          id: "builtin:email:mine",
          name: "Assigned to me",
          config: encodeViewConfig({
            ...defaults,
            filters: { assignee: ["mine"] },
          }),
        },
        {
          id: "builtin:email:unassigned",
          name: "Unassigned",
          config: encodeViewConfig({
            ...defaults,
            filters: { assignee: ["unassigned"] },
          }),
        },
      ]
        .map<QuickFilter>((view) => ({
          ...view,
          user_id: null,
          target_entity: "email",
          created_at: "",
          updated_at: "",
        }))
        .concat(savedViews.data ?? []),
    [savedViews.data],
  );
  useRegisterPageActions("/email", [
    {
      id: "compose-email",
      title: "Compose email",
      icon: Plus,
      action: compose,
      disabled: !mailbox.data,
    },
    {
      id: "refresh-email",
      title: "Refresh mailbox from Microsoft",
      icon: RefreshCw,
      action: () => sync.mutate(),
      disabled: sync.isPending,
    },
  ]);
  const rows = mailbox.data?.threads ?? [];
  function open(row: EmailSummary) {
    setSelected(row.id);
    openThread(row.id, row.subject);
  }
  const lastPage = mailbox.data?.sync
    .map((state) => state.page_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const title =
    folder === "@scheduled"
      ? "Scheduled"
      : (mailbox.data?.folders.find((item) => item.id === folder)?.name ??
        "All mail");
  const loading = mailbox.isLoading || mailbox.isPlaceholderData;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-lg font-semibold">Mail</h1>
          <span className="truncate text-xs text-muted-foreground">
            {mailbox.data?.mailboxAddress ?? "Mailbox"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={compose}
          disabled={!mailbox.data}
        >
          <Plus className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        <MailFolders
          folders={mailbox.data?.folders ?? []}
          loading={!mailbox.data}
          selected={folder}
          onSelect={(id) => {
            setFolder(id);
            setOffset(0);
          }}
        />
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-5"
          aria-label="Email list"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest(
                "input,textarea,[role=combobox],[contenteditable=true]",
              )
            )
              return;
            if (["j", "k"].includes(event.key)) {
              event.preventDefault();
              const index = rows.findIndex((row) => row.id === selected);
              setSelected(
                rows[
                  Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      index + (event.key === "j" ? 1 : -1),
                    ),
                  )
                ]?.id,
              );
            }
            if (event.key === "Enter" && event.target === event.currentTarget) {
              const row = rows.find((item) => item.id === selected);
              if (row) {
                event.preventDefault();
                open(row);
              }
            }
          }}
        >
          <DataTableToolbar
            viewTarget="email"
            state={{
              search,
              ...settings,
              page: Math.floor(offset / 50) + 1,
              pageSize: 50,
            }}
            onSearchChange={setSearch}
            onFiltersChange={(filters) => {
              setSettings((all) => ({ ...all, filters }));
              setOffset(0);
            }}
            onSortChange={(sortBy, sortDirection) => {
              setSettings((all) => ({ ...all, sortBy, sortDirection }));
              setOffset(0);
            }}
            onGroupByChange={(groupBy) =>
              setSettings((all) => ({ ...all, groupBy }))
            }
            onVisibleColumnsChange={(visibleColumns) =>
              setSettings((all) => ({ ...all, visibleColumns }))
            }
            onQuickFilterApply={(view) => {
              setSettings(readViewSettings(view.config, defaults));
              setOffset(0);
            }}
            onReset={() => {
              setSettings(defaults);
              setOffset(0);
            }}
            quickFilters={views}
            filterDefinitions={[
              {
                key: "assignee",
                label: "Assignee",
                options: [
                  { value: "mine", label: "Assigned to me" },
                  { value: "unassigned", label: "Unassigned" },
                  ...(mailbox.data?.staff ?? []).map((person) => ({
                    value: person.id,
                    label: [person.first_name, person.last_name]
                      .filter(Boolean)
                      .join(" "),
                  })),
                ],
              },
            ]}
            sortOptions={[
              { key: "received", label: "Received" },
              { key: "sender", label: "Sender" },
            ]}
            columnDefinitions={[
              { key: "time", label: "Received", visibleByDefault: true },
              { key: "preview", label: "Preview", visibleByDefault: true },
            ]}
            defaultVisibleColumns={defaults.visibleColumns}
            searchPlaceholder="Search mail…"
          />

          <h2 className="shrink-0 px-3 py-4 text-sm font-semibold">{title}</h2>
          {mailbox.error && (
            <p role="alert" className="p-3 text-sm text-destructive">
              {mailbox.error.message}
            </p>
          )}
          <div
            className="min-h-0 flex-1 space-y-1 overflow-auto"
            aria-busy={loading}
          >
            {loading ? (
              <div aria-label="Loading emails" className="space-y-3 p-3">
                {Array.from({ length: 7 }, (_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-md" />
                ))}
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  draggable
                  data-email-shortcut-target
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      emailDragType,
                      JSON.stringify(row.messageIds),
                    );
                  }}
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(undefined)}
                  onFocus={() => setHovered(row.id)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      setHovered(undefined);
                  }}
                  className={`group flex min-w-0 items-center gap-2 rounded-md px-3 py-3 ${selected === row.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => open(row)}
                    aria-label={`Open ${row.subject || "email conversation"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.read ? "bg-transparent" : "bg-primary"}`}
                    />
                    <span
                      className={`w-28 shrink-0 truncate text-xs ${row.read ? "" : "font-semibold"}`}
                    >
                      {row.senderName || row.sender || "Draft"}
                    </span>
                    <span className="flex min-w-0 flex-1 gap-2 text-xs">
                      <span
                        className={`max-w-[60%] shrink-0 truncate ${row.read ? "" : "font-medium"}`}
                      >
                        {row.draft ? "Draft · " : ""}
                        {row.subject || "(no subject)"}
                      </span>
                      {settings.visibleColumns.includes("preview") && (
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {row.preview}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    {mailbox.data && (
                      <EmailActions
                        ids={row.messageIds}
                        threadId={row.id}
                        read={row.read}
                        assignedStaffId={row.assignedStaffId}
                        mailbox={mailbox.data}
                        hovered={hovered === row.id}
                        compact
                        onReply={() => openThread(row.id, row.subject, "reply")}
                        onForward={() =>
                          openThread(row.id, row.subject, "forward")
                        }
                      />
                    )}
                  </div>
                  {settings.visibleColumns.includes("time") && (
                    <span className="hidden w-14 shrink-0 text-right text-[11px] text-muted-foreground md:block">
                      {row.at
                        ? new Date(row.at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Draft"}
                    </span>
                  )}
                </div>
              ))
            )}
            {!loading && !mailbox.error && !rows.length && (
              <p className="p-12 text-center text-xs text-muted-foreground">
                No email in this view.
              </p>
            )}
          </div>
          <TablePagination
            page={Math.floor(offset / 50) + 1}
            pageSize={50}
            hasNextPage={mailbox.data?.hasMore}
            isFetching={loading}
            onPageChange={(page) => setOffset((page - 1) * 50)}
            showPageSizeSelector={false}
            className="mt-4 shrink-0"
          />
        </section>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <div>
          <p role="status">
            {sync.isPending
              ? "Syncing with Microsoft…"
              : configured === false
                ? "Mailbox connection is not configured"
                : lastPage
                  ? `Updated ${new Date(lastPage).toLocaleTimeString("en-AU")}`
                  : "Not synced yet"}
          </p>
          {sync.error && (
            <p role="alert" className="text-destructive">
              {sync.error.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/settings/email"
            aria-label="Email settings"
            title="Email settings"
            className="rounded-md p-2 hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
          <EmailIconButton
            label="Refresh mailbox"
            variant="ghost"
            className="border-0 bg-transparent shadow-none"
            disabled={sync.isPending || !configured}
            onClick={() => sync.mutate()}
          >
            <RefreshCw
              className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`}
            />
          </EmailIconButton>
        </div>
      </footer>
    </div>
  );
}
