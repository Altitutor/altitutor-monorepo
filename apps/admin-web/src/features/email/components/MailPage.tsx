"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Folder, Plus, RefreshCw, Settings2 } from "lucide-react";
import { Button, DataTableToolbar } from "@altitutor/ui";
import {
  encodeViewConfig,
  readViewSettings,
  type DisplaySettings,
  type QuickFilter,
} from "@altitutor/shared";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";
import { useRegisterPageActions } from "@/features/command-palette/RecordActionsContext";
import { useMailbox, useEmailCommand, useSyncMailbox } from "../api/client";
import { useOpenEmailThread } from "../hooks/useOpenEmailThread";
import {
  draftResponseSchema,
  type EmailMessage,
  type EmailSummary,
} from "../types";
import { EmailIconButton } from "./EmailIconButton";
import { EmailAssignee } from "./EmailAssignee";
import { EmailSettingsDialog } from "./EmailSettingsDialog";
import { EmailComposer } from "./EmailComposer";
const defaults: DisplaySettings = {
  filters: {},
  sortBy: "received",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: ["assignee", "time", "preview"],
};
const dragType = "application/x-altitutor-email-message-ids";
export function MailPage() {
  const [folder, setFolder] = useState<string>();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [settings, setSettings] = useState(defaults);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<EmailMessage | null>(null);
  const [draftReady, setDraftReady] = useState<
    Promise<{ message?: EmailMessage }> | undefined
  >();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signature, setSignature] = useState<string>();
  const [notice, setNotice] = useState("");
  const mailbox = useMailbox({
    folder,
    search: term,
    assignee: settings.filters.assignee?.map(String).join(",") || "all",
    offset,
    sort: settings.sortBy ?? "received",
    direction: settings.sortDirection,
  });
  const command = useEmailCommand();
  const sync = useSyncMailbox();
  const syncBusy = useRef(false);
  const openThread = useOpenEmailThread();
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
        /* Display the mutation's error and retain cached reads. */
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
  function compose() {
    if (!mailbox.data || draft) return;
    // Render immediately; the provider draft is prepared behind the editor.
    setDraft({
      id: `local:${crypto.randomUUID()}`,
      threadId: "",
      subject: "",
      bodyText: "",
      sender: mailbox.data.mailboxAddress,
      to: [],
      cc: [],
      bcc: [],
      draft: true,
      removed: false,
    });
    setSignature(mailbox.data.signature);
    setDraftReady(
      command
        .mutateAsync({ action: "draft", mode: "new" })
        .then((value) => draftResponseSchema.parse(value)),
    );
  }
  useRegisterPageActions("/email", [
    {
      id: "compose-email",
      title: "Compose email",
      icon: Plus,
      action: () => {
        void compose();
      },
      disabled: command.isPending,
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
    mailbox.data?.folders.find((item) => item.id === folder)?.name ??
    "All mail";
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Mail</h1>
          <span className="text-xs text-muted-foreground">
            {mailbox.data?.mailboxAddress ?? "Mailbox"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmailIconButton
            label="Email templates and signature"
            onClick={() => setSettingsOpen(true)}
            disabled={!mailbox.data}
          >
            <Settings2 className="h-4 w-4" />
          </EmailIconButton>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !configured}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void compose()}
            disabled={command.isPending || !configured}
          >
            <Plus className="mr-1 h-4 w-4" />
            Compose
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside
          className="shrink-0 border-b p-3 lg:w-44 lg:border-b-0 lg:border-r"
          aria-label="Microsoft email folders"
        >
          <div className="flex gap-1 overflow-auto lg:flex-col">
            <button
              className={`shrink-0 rounded-md px-3 py-2 text-left text-xs ${folder === "" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => {
                setFolder("");
                setOffset(0);
              }}
            >
              All mail
            </button>
            {mailbox.data?.folders.map((item) => (
              <button
                key={item.id}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs ${folder === item.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                style={{
                  paddingLeft: mailbox.data?.folders.some(
                    (parent) => parent.id === item.parent_id,
                  )
                    ? "1.5rem"
                    : undefined,
                }}
                onClick={() => {
                  setFolder(item.id);
                  setOffset(0);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(dragType))
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  try {
                    const ids = z
                      .array(z.string())
                      .min(1)
                      .parse(JSON.parse(event.dataTransfer.getData(dragType)));
                    command.mutate({ action: "move", ids, folderId: item.id });
                  } catch {
                    setNotice("Could not read the dragged email selection.");
                  }
                }}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </aside>
        <section
          className="min-w-0 flex-1 overflow-auto p-3 sm:p-5"
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
              { key: "assignee", label: "Assignee", visibleByDefault: true },
              { key: "time", label: "Received", visibleByDefault: true },
              { key: "preview", label: "Preview", visibleByDefault: true },
            ]}
            defaultVisibleColumns={defaults.visibleColumns}
            searchPlaceholder="Search mail…"
          />
          <h2 className="px-3 py-4 text-sm font-semibold">{title}</h2>
          {mailbox.isLoading && (
            <p className="p-6 text-sm text-muted-foreground">
              Loading mailbox…
            </p>
          )}
          {mailbox.error && (
            <p role="alert" className="p-3 text-sm text-destructive">
              {mailbox.error.message}
            </p>
          )}
          <div className="space-y-1">
            {rows.map((row) => (
              <div
                key={row.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    dragType,
                    JSON.stringify(row.messageIds),
                  );
                }}
                className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-3 ${selected === row.id ? "bg-muted" : "hover:bg-muted/50"}`}
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
                {settings.visibleColumns.includes("assignee") &&
                  mailbox.data && (
                    <div className="w-28 shrink-0">
                      <EmailAssignee
                        threadId={row.id}
                        value={row.assignedStaffId}
                        staff={mailbox.data.staff}
                      />
                    </div>
                  )}
                {settings.visibleColumns.includes("time") && (
                  <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground md:block">
                    {row.at
                      ? new Date(row.at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })
                      : "Draft"}
                  </span>
                )}
              </div>
            ))}
          </div>
          {!mailbox.isLoading && !mailbox.error && !rows.length && (
            <p className="p-12 text-center text-xs text-muted-foreground">
              No email in this view.
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!offset || mailbox.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!mailbox.data?.hasMore || mailbox.isFetching}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </Button>
          </div>
        </section>
      </div>
      <footer className="border-t px-4 py-2 text-xs text-muted-foreground">
        <p role="status">
          {sync.isPending
            ? "Syncing with Microsoft…"
            : configured === false
              ? "Mailbox connection is not configured"
              : lastPage
                ? `Updated ${new Date(lastPage).toLocaleTimeString("en-AU")}`
                : "Not synced yet"}
        </p>
        {(notice || command.error || sync.error) && (
          <p role="alert" className="mt-1 text-destructive">
            {notice || command.error?.message || sync.error?.message}
          </p>
        )}
        {mailbox.data?.sync.some((state) => state.last_error) && (
          <p className="mt-1 text-destructive">
            Some folders need another sync. Cached mail remains readable.
          </p>
        )}
      </footer>
      {settingsOpen && mailbox.data && (
        <EmailSettingsDialog
          mailbox={mailbox.data}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {draft && mailbox.data && (
        <EmailComposer
          key={draft.id}
          draft={draft}
          mailbox={mailbox.data}
          signature={signature}
          draftReady={draftReady}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
