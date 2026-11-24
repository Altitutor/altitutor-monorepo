"use client";
import { AdminPageActionButton } from "@/shared/components/admin-page-action-button";
import { Breadcrumb } from "@/shared/components/Breadcrumb";
import { adminPageHeaderClass } from "@/shared/components/adminPageHeaderStyle";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { ListSettingsMenu } from "@/shared/components/ListSettingsMenu";
import { AdminActionGroup } from "@/shared/components/AdminActionGroup";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Reply } from "lucide-react";
import { ConversationPanes } from "@/shared/components/ConversationPanes";
import { EmailThreadView } from "./EmailThreadView";
import { paneCloseEvent, withPaneCloseGate } from "@/shared/components/pane-workspace/pane-routing";
import {
  DataTableToolbar,
  Skeleton,
} from "@altitutor/ui";
import {
  encodeViewConfig,
  readViewSettings,
  type QuickFilter,
} from "@altitutor/shared";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";
import { useRegisterPageActions } from "@/features/command-palette/RecordActionsContext";
import { useMailboxList, useSyncMailbox } from "../api/client";
import {
  useComposeEmail,
  useOpenEmailThread,
} from "../hooks/useOpenEmailThread";
import type { EmailSummary } from "../types";
import { EmailIconButton } from "./EmailIconButton";
import styles from "./mail-list.module.css";
import { EmailActions } from "./EmailActions";
import { MailFolders, emailDragType, mailFolderLabel } from "./MailFolders";
import { defaultMailListSettings as defaults, useMailListState } from "../hooks/useMailListState";

export function MailPage() {
  const { list, setList, ready } = useMailListState();
  const { search, settings } = list;
  const [term, setTerm] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const { router, searchParams } = usePaneNavigation();
  const inlineThread = searchParams.get("conversation");
  const routeFolder = searchParams.get("folder");
  const folder = routeFolder ?? list.folder;
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (ready && routeFolder !== null) {
      setList((current) => current.folder === routeFolder ? current : { ...current, folder: routeFolder });
    }
  }, [ready, routeFolder, setList]);
  useEffect(() => setSelected(inlineThread ?? undefined), [inlineThread]);
  const inlineClose = useRef<((next?: () => void) => void) | null>(null);
  const registerInlineClose = useCallback((gate: typeof inlineClose.current) => {
    inlineClose.current = gate;
  }, []);
  useEffect(() => {
    const close = (event: Event) => {
      if (!inlineClose.current) return;
      event.preventDefault();
      inlineClose.current((event as CustomEvent<() => void>).detail);
    };
    window.addEventListener(paneCloseEvent, close);
    return () => window.removeEventListener(paneCloseEvent, close);
  }, []);
  const [hovered, setHovered] = useState<string>();
  const mailbox = useMailboxList({
    folder,
    search: term ?? search,
    assignee: settings.filters.assignee?.map(String).join(",") || "all",
    from: settings.filters.from?.map(String).join(",") || "",
    sort: settings.sortBy ?? "received",
    direction: settings.sortDirection,
  }, ready);
  const mailboxData = mailbox.data?.pages[0];
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, isPlaceholderData } = mailbox;
  const scrollList = useRef<HTMLDivElement>(null);
  const loadMarker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollList.current;
    const marker = loadMarker.current;
    if (!root || !marker || !hasNextPage || isFetching || isFetchNextPageError || isPlaceholderData) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
    }, { root, rootMargin: "0px 0px 160px" });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, isPlaceholderData]);
  useEffect(() => { if (scrollList.current) scrollList.current.scrollTop = 0; }, [folder, term, settings.filters, settings.sortBy, settings.sortDirection]);
  const sync = useSyncMailbox();
  const syncBusy = useRef(false);
  const openThread = useOpenEmailThread();
  const compose = useComposeEmail();
  const savedViews = useQuickFilters("email");
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setTerm(search), 250);
    return () => clearTimeout(timer);
  }, [ready, search]);
  useEffect(() => {
    if (folder === undefined && mailboxData) {
      const inbox = mailboxData.folders.find((item) => item.role === "inbox");
      if (inbox) setList((current) => current.folder === undefined ? { ...current, folder: inbox.id } : current);
    }
  }, [folder, mailboxData, setList]);
  const configured = mailboxData?.configured;
  const syncNow = sync.mutateAsync;
  useEffect(() => {
    if (!configured) return;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || syncBusy.current) return;
      syncBusy.current = true;
      try {
        await syncNow(true);
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
      title: "Create email",
      keywords: ["compose"],
      icon: Plus,
      action: compose,
      disabled: !mailboxData,
    },
    {
      id: "refresh-email",
      title: "Refresh mailbox from Microsoft",
      icon: RefreshCw,
      action: () => sync.mutate(false),
      disabled: sync.isPending,
    },
  ]);
  const rows = useMemo(() => {
    const firstById = new Map<string, EmailSummary>();
    for (const page of mailbox.data?.pages ?? []) {
      for (const row of page.threads) if (!firstById.has(row.id)) firstById.set(row.id, row);
    }
    return [...firstById.values()];
  }, [mailbox.data]);
  function setPreviewThread(thread?: string, nextFolder = folder) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["conversation", "message", "focus", "action", "token"]) {
      params.delete(key);
    }
    if (nextFolder !== undefined) params.set("folder", nextFolder);
    if (thread) params.set("conversation", thread);
    const query = params.toString();
    const href = query ? `/email?${query}` : "/email";
    if (thread && !inlineThread) router.push(href, { scroll: false });
    else withPaneCloseGate(() => {
      if (nextFolder !== folder) setList((current) => ({ ...current, folder: nextFolder }));
      router.replace(href, { scroll: false });
    });
  }
  function open(row: EmailSummary) {
    setSelected(row.id);
    if (row.draft) {
      openThread(row.id, row.subject, "draft", row.messageIds.at(-1));
    } else if (inlineThread !== row.id) {
      setPreviewThread(row.id);
    }
  }
  const lastPage = mailboxData?.sync
    .map((state) => state.page_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const folders = mailboxData?.folders ?? [];
  const folderItem = {
    label: mailFolderLabel(folders, folder),
    control: (
      <MailFolders
        folders={folders}
        selected={folder}
        dragging={dragging}
        onDragComplete={() => setDragging(false)}
        onSelect={(id) => setPreviewThread(undefined, id)}
      />
    ),
  };
  const folderQuery = folder === undefined ? "" : `?${new URLSearchParams({ folder })}`;
  const loading = !ready || mailbox.isLoading || mailbox.isPlaceholderData;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={setHeaderTarget} className="shrink-0">
        {!inlineThread && (
          <div className={adminPageHeaderClass} data-admin-page-header>
            <Breadcrumb items={[{ label: "Email" }, folderItem]} className="mb-0 min-w-0 flex-1" />
            <ListSettingsMenu list="mail" inline />
            <AdminActionGroup label="Email actions">
              <EmailIconButton
                label={
                  sync.error
                    ? sync.error.message
                    : sync.isPending
                      ? "Syncing with Microsoft…"
                      : configured === false
                        ? "Mailbox connection is not configured"
                        : lastPage
                          ? `Updated ${new Date(lastPage).toLocaleTimeString("en-AU")}`
                          : "Not synced yet"
                }
                aria-label="Sync mailbox"
                variant="ghost"
                className="border-0 bg-transparent shadow-none"
                disabled={sync.isPending || !configured}
                onClick={() => sync.mutate(false)}
              >
                <RefreshCw
                  className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`}
                />
              </EmailIconButton>
            </AdminActionGroup>
            <AdminPageActionButton
              icon={<Plus className="size-4" />}
              createShortcut
              label="Create email"
              onClick={compose}
              disabled={!mailboxData}
            />
          </div>
        )}
      </div>
      <ConversationPanes
        label="Email reading pane"
        list={
        <section
          className={`${styles.list} flex min-h-0 min-w-0 flex-1 flex-col p-4`}
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
              page: 1,
              pageSize: 50,
            }}
            onSearchChange={(search) => setList((current) => ({ ...current, search }))}
            onFiltersChange={(filters) => setList((current) => ({
              ...current, settings: { ...current.settings, filters },
            }))}
            onSortChange={(sortBy, sortDirection) => setList((current) => ({
              ...current, settings: { ...current.settings, sortBy, sortDirection },
            }))}
            onGroupByChange={(groupBy) => setList((current) => ({
              ...current, settings: { ...current.settings, groupBy },
            }))}
            onVisibleColumnsChange={(visibleColumns) => setList((current) => ({
              ...current, settings: { ...current.settings, visibleColumns },
            }))}
            onQuickFilterApply={(view) => setList((current) => ({
              ...current, settings: readViewSettings(view.config, defaults),
            }))}
            onReset={() => setList((current) => ({ ...current, settings: defaults }))}
            quickFilters={views}
            allowEmptyColumns
            filterDefinitions={[
              {
                key: "from",
                label: "From",
                options: (mailboxData?.senders ?? []).map((sender) => ({
                  value: sender.email,
                  label: sender.name
                    ? `${sender.name} · ${sender.email}`
                    : sender.email,
                })),
              },
              {
                key: "assignee",
                label: "Assignee",
                options: [
                  { value: "mine", label: "Assigned to me" },
                  { value: "unassigned", label: "Unassigned" },
                  ...(mailboxData?.staff ?? []).map((person) => ({
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
              { key: "avatar", label: "Avatar", visibleByDefault: false },
              { key: "sender", label: "Sender", visibleByDefault: true },
              { key: "subject", label: "Subject", visibleByDefault: true },
              { key: "assignee", label: "Assignee", visibleByDefault: true },
              { key: "time", label: "Received", visibleByDefault: true },
              { key: "preview", label: "Preview", visibleByDefault: true },
            ]}
            defaultVisibleColumns={defaults.visibleColumns}
            searchPlaceholder="Search mail…"
          />

          {mailbox.error && !isFetchNextPageError && (
            <p role="alert" className="p-3 text-sm text-destructive">
              {mailbox.error.message}
            </p>
          )}
          <div
            ref={scrollList}
            className={styles.rows}
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
                  onClick={() => open(row)}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      ["Enter", " "].includes(event.key)
                    ) {
                      event.preventDefault();
                      open(row);
                    }
                  }}
                  data-shortcut-list-item
                  tabIndex={0}
                  data-email-shortcut-target
                  data-pane-href={`/email/${encodeURIComponent(row.id)}${folderQuery}`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(true);
                    event.dataTransfer.setData(
                      emailDragType,
                      JSON.stringify(row.messageIds),
                    );
                  }}
                  onDragEnd={() => setDragging(false)}
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(undefined)}
                  onFocus={() => { setHovered(row.id); setSelected(row.id); }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      setHovered(undefined);
                  }}
                  className={`${styles.row} group relative flex min-h-10 min-w-0 cursor-pointer items-center gap-2 ${(selected ?? inlineThread) === row.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <button
                    className={`${styles.open} flex min-w-0 flex-1 items-start gap-2 text-left`}
                    onClick={(event) => {
                      event.stopPropagation();
                      open(row);
                    }}
                    aria-label={`Open ${row.subject || "email conversation"}`}
                    aria-current={inlineThread === row.id ? "true" : undefined}
                  >
                    <span
                      className={`${styles.unread} size-1.5 shrink-0 rounded-full ${row.read ? "bg-transparent" : "bg-primary"}`}
                    />
                    {settings.visibleColumns.includes("avatar") && (
                      <span aria-hidden data-email-avatar className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                        {(row.senderName || row.sender || "Draft").trim().split(/[\s@._-]+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "?"}
                      </span>
                    )}
                    {row.repliedAt && (
                      <Reply
                        role="img"
                        aria-label="Replied"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      >
                        <title>{`Replied ${new Date(row.repliedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`}</title>
                      </Reply>
                    )}
                    <span className={`${styles.fields} flex min-w-0 flex-1 flex-col gap-0.5 text-xs`}>
                      {settings.visibleColumns.includes("sender") && (
                        <span
                          className={`${styles.sender} min-w-0 shrink truncate ${row.read ? "" : "font-semibold"}`}
                        >
                          {row.senderName || row.sender || "Draft"}
                        </span>
                      )}
                      <span className={`${styles.fields} flex min-w-0 flex-1 flex-col gap-0.5`}>
                        {settings.visibleColumns.includes("subject") && (
                          <span
                            className={`${styles.subject} shrink-0 truncate ${row.read ? "" : "font-medium"}`}
                          >
                            {folder === "@scheduled"
                              ? "Scheduled · "
                              : row.draft
                                ? "Draft · "
                                : ""}
                            {row.subject || "(no subject)"}
                          </span>
                        )}
                        {settings.visibleColumns.includes("preview") && (
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {row.preview}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="hidden shrink-0 group-hover:block group-focus-within:block group-has-[[data-state=open]]:block [@media(hover:none)]:block">
                    {mailboxData && (
                      <EmailActions
                        ids={row.messageIds}
                        threadId={row.id}
                        read={row.read}
                        assignedStaffId={row.assignedStaffId}
                        mailbox={mailboxData}
                        hovered={hovered === row.id}
                        hideAssignee={
                          !settings.visibleColumns.includes("assignee")
                        }
                        compact
                        onReply={() => openThread(row.id, row.subject, "reply")}
                        onForward={() =>
                          openThread(row.id, row.subject, "forward")
                        }
                      />
                    )}
                  </div>
                  {settings.visibleColumns.includes("assignee") &&
                    row.assignedStaffId && (
                      <span
                        className="max-w-28 shrink-0 truncate rounded-full border bg-muted/25 px-2 py-1 text-xs text-muted-foreground group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden [@media(hover:none)]:hidden"
                        title={mailboxData?.staff
                          .filter((person) => person.id === row.assignedStaffId)
                          .map((person) =>
                            [person.first_name, person.last_name]
                              .filter(Boolean)
                              .join(" "),
                          )
                          .join("")}
                      >
                        {" "}
                        {mailboxData?.staff
                          .filter((person) => person.id === row.assignedStaffId)
                          .map((person) =>
                            [person.first_name, person.last_name]
                              .filter(Boolean)
                              .join(" "),
                          )
                          .join("") || "Assigned staff"}
                      </span>
                    )}
                  {settings.visibleColumns.includes("time") && (
                    <span className="hidden w-14 shrink-0 text-right text-[11px] text-muted-foreground group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden [@media(hover:none)]:hidden md:block">
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
            {hasNextPage && (
              <div ref={loadMarker} className="flex min-h-1 justify-center">
                {mailbox.isFetchingNextPage && <span role="status" className="p-2 text-xs text-muted-foreground">Loading more email…</span>}
                {isFetchNextPageError && <button type="button" className="p-2 text-sm underline" onClick={() => void fetchNextPage()}>Retry loading more email</button>}
              </div>
            )}
            {!loading && !mailbox.error && !rows.length && (
              <p className="p-12 text-center text-xs text-muted-foreground">
                No email in this view.
              </p>
            )}
          </div>

        </section>
        }
        thread={inlineThread && (
          <EmailThreadView
            key={inlineThread}
            threadId={inlineThread}
            registerInlineClose={registerInlineClose}
            onBack={() => setPreviewThread()}
            headerTarget={headerTarget}
            folderItem={folderItem}
          />
        )}
      />
    </div>
  );
}
