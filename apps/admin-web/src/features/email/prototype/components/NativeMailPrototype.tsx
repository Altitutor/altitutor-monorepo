"use client";

// DEV-250 throwaway native-component preview. Mail, tabs and mutations are fixtures.
// The final feature registers real email tabs/actions; this preview never mounts live messaging.
import { useEffect, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  FileText,
  Folder,
  Mail,
  Paperclip,
  Plus,
  Reply,
  Search,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DataTableToolbar,
  Input,
  SearchableSelect,
  SegmentedControl,
  Textarea,
  ToolbarViewsProvider,
} from "@altitutor/ui";
import {
  encodeViewConfig,
  readViewSettings,
  type DisplaySettings,
  type QuickFilter,
} from "@altitutor/shared";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { PaletteBrowser } from "@/features/command-palette/components/PaletteBrowser";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";

type MailItem = {
  id: string;
  sender: string;
  address: string;
  subject: string;
  preview: string;
  body: string;
  folder: string;
  read: boolean;
  assignee: string | null;
  kind: "Parent" | "Student" | "Staff" | null;
  time: string;
};
const initialMail: MailItem[] = [
  {
    id: "alex",
    sender: "Taylor Morgan",
    address: "taylor@example.test",
    subject: "Could Alex move to Saturday?",
    preview:
      "Our basketball schedule has changed. Is there room in the Saturday class?",
    body: "Hi team,\n\nAlex's basketball training has moved to Wednesday evenings. Could we move his chemistry class to Saturday instead?\n\nHe is happy to start next week if there is a place available.\n\nThanks,\nTaylor",
    folder: "Inbox",
    read: false,
    assignee: "Jane Smith",
    kind: "Parent",
    time: "10:42",
  },
  {
    id: "absence",
    sender: "Priya Shah",
    address: "priya@example.test",
    subject: "Absent this evening",
    preview: "Maya is unwell and won't be able to make it tonight.",
    body: "Hi Altitutor,\n\nMaya is unwell and won't be able to attend this evening. Please let her tutor know.\n\nThank you,\nPriya",
    folder: "Inbox",
    read: false,
    assignee: null,
    kind: "Parent",
    time: "10:18",
  },
  {
    id: "work",
    sender: "Jordan Lee",
    address: "jordan@example.test",
    subject: "Homework for next week",
    preview: "Here is the worksheet I mentioned after class yesterday.",
    body: "Hi,\n\nCould you pass this worksheet on to my chemistry tutor? These are the questions I got stuck on.\n\nThanks,\nJordan",
    folder: "Inbox",
    read: true,
    assignee: null,
    kind: "Student",
    time: "09:51",
  },
  {
    id: "unknown",
    sender: "sam@example.test",
    address: "sam@example.test",
    subject: "Enquiry about chemistry tuition",
    preview: "Hello, I would like to ask about your Saturday chemistry class.",
    body: "Hello,\n\nI would like to ask about your Saturday chemistry class. Is there a place available?\n\nThanks,\nSam",
    folder: "Inbox",
    read: true,
    assignee: null,
    kind: null,
    time: "09:06",
  },
  {
    id: "sent",
    sender: "Taylor Morgan",
    address: "taylor@example.test",
    subject: "Alex's enrolment confirmation",
    preview:
      "Alex is enrolled in Wednesday Chemistry. Your class details are below.",
    body: "Hi Taylor,\n\nAlex is enrolled in Wednesday Chemistry. This fictional operational email appears in shared Sent and relevant Activity.\n\nAltitutor",
    folder: "Sent",
    read: true,
    assignee: null,
    kind: "Parent",
    time: "Yesterday",
  },
];
const folders = [
  "Inbox",
  "Sent",
  "Drafts",
  "Archive",
  "Enrolments",
  "Invoice queries",
];
const staff = ["Jane Smith", "Chris Walker"];
const templates = [
  {
    id: "class",
    name: "Class change follow-up",
    body: "Hi Taylor,\n\nWe can move Alex to the Saturday class. I will confirm the details shortly.",
  },
  {
    id: "absence",
    name: "Absence acknowledgement",
    body: "Hi,\n\nThanks for letting us know. We have passed this on to the tutor.",
  },
];
const defaults: DisplaySettings = {
  filters: {},
  sortBy: "time",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: ["assignee", "time", "preview"],
};
const defaultViews: QuickFilter[] = [
  { id: "builtin:email:all", name: "All", config: encodeViewConfig(defaults) },
  {
    id: "builtin:email:mine",
    name: "Assigned to me",
    config: encodeViewConfig({
      ...defaults,
      filters: { assignee: ["Jane Smith"] },
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
].map((view) => ({
  ...view,
  user_id: null,
  target_entity: "email",
  created_at: "",
  updated_at: "",
}));

function Assignee({
  value,
  onChange,
  pill = false,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
  pill?: boolean;
}) {
  return (
    <SearchableSelect
      items={staff}
      value={value}
      onValueChange={onChange}
      getItemId={(item) => item}
      getItemLabel={(item) => item}
      allowClear
      clearLabel="Unassigned"
      searchPlaceholder="Search active adminstaff…"
      contentWidth="260px"
      trigger={
        <Button
          variant={pill ? "outline" : "ghost"}
          size="sm"
          className={
            pill
              ? "h-8 rounded-full px-3 text-xs"
              : "h-7 max-w-full justify-start px-2 text-xs"
          }
        >
          <UserRound className="mr-1.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{value ?? "Unassigned"}</span>
        </Button>
      }
    />
  );
}

export function NativeMailPrototype() {
  const globalPalette = useCommandPalette();
  const [items, setItems] = useState(initialMail);
  const [folder, setFolder] = useState("Inbox");
  const [selected, setSelected] = useState("alex");
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [settings, setSettings] = useState(defaults);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string[]>>({});
  const [activity, setActivity] = useState(false);
  const [replyMode, setReplyMode] = useState("Reply");
  const [linkedChild, setLinkedChild] = useState(false);
  const [compose, setCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [contact, setContact] = useState<MailItem | null>(null);
  const [contactAction, setContactAction] = useState<string | null>(null);
  const [commands, setCommands] = useState(false);
  const [notice, setNotice] = useState(
    "Fictional mail · no live Microsoft account connected",
  );
  const thread = items.find((item) => item.id === active);
  const rows = items
    .filter(
      (item) =>
        (folder === "Drafts"
          ? Boolean(drafts[item.id]?.trim())
          : item.folder === folder) &&
        (!settings.filters.assignee?.length ||
          settings.filters.assignee.includes(item.assignee ?? "unassigned")) &&
        `${item.sender} ${item.subject} ${item.body}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      settings.sortBy === "sender"
        ? a.sender.localeCompare(b.sender) *
          (settings.sortDirection === "asc" ? 1 : -1)
        : settings.sortDirection === "asc"
          ? initialMail.indexOf(b) - initialMail.indexOf(a)
          : 0,
    );
  function patch(id: string, values: Partial<MailItem>) {
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  function open(item: MailItem) {
    setSelected(item.id);
    setTabs((all) => (all.includes(item.id) ? all : [...all, item.id]));
    setActive(item.id);
    patch(item.id, { read: true });
  }
  function assign(item: MailItem, name: string | null) {
    patch(item.id, { assignee: name });
    setNotice(
      name
        ? `${name} assigned and notified. Reading preserves responsibility.`
        : "Thread unassigned.",
    );
  }
  function move(id: string, target: string) {
    patch(id, { folder: target });
    setNotice(
      `Simulated Microsoft move to ${target}. Provider folders remain authoritative.`,
    );
  }
  function closeTab(id: string) {
    const next = tabs.filter((tab) => tab !== id);
    setTabs(next);
    if (active === id) setActive(next.at(-1) ?? null);
  }
  function sendReply() {
    if (!thread || !drafts[thread.id]?.trim()) return;
    const body = drafts[thread.id].trim();
    setReplies((all) => ({
      ...all,
      [thread.id]: [...(all[thread.id] ?? []), body],
    }));
    patch(thread.id, { assignee: null });
    setItems((all) => [
      ...all,
      {
        ...thread,
        id: `sent-${Date.now()}`,
        folder: "Sent",
        subject: `Re: ${thread.subject}`,
        body,
        preview: body,
        assignee: null,
        read: true,
        time: "Now",
      },
    ]);
    setDrafts((all) => ({ ...all, [thread.id]: "" }));
    setNotice(
      "Simulated reply in Sent; assignment cleared. Nothing delivered.",
    );
  }
  function composerToolbar(
    body: string,
    onBody: (body: string) => void,
    onSend: () => void,
  ) {
    return (
      <div className="flex items-center justify-between gap-2 border-t p-2">
        <div className="flex min-w-0 items-center gap-2">
          <SearchableSelect
            items={templates}
            value={null}
            onValueChange={(template) => {
              if (template) onBody(template.body);
            }}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.name}
            searchPlaceholder="Search templates…"
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label="Insert email template"
              >
                <FileText className="h-4 w-4" />
              </Button>
            }
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Attach files"
            onClick={() =>
              setNotice("Fictional attachment selected; no file uploaded.")
            }
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <SearchableSelect
            items={["Altitutor Admin <admin@altitutor.com>"]}
            value="Altitutor Admin <admin@altitutor.com>"
            onValueChange={() => {}}
            getItemId={(item) => item}
            getItemLabel={(item) => item}
            searchPlaceholder="Search senders…"
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-10 max-w-36 truncate text-xs"
              >
                Admin mailbox
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            }
          />
        </div>
        <Button
          className="h-10 shrink-0"
          disabled={!body.trim()}
          onClick={onSend}
        >
          Send
        </Button>
      </div>
    );
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            "input,textarea,[role=dialog],[role=combobox],select,[contenteditable=true]",
          ))
      )
        return;
      const index = rows.findIndex((item) => item.id === selected);
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const item =
          rows[
            Math.max(
              0,
              Math.min(rows.length - 1, index + (event.key === "j" ? 1 : -1)),
            )
          ];
        if (item) setSelected(item.id);
      }
      if (event.key === "Enter") {
        const item = rows.find((row) => row.id === selected);
        if (item) {
          event.preventDefault();
          open(item);
        }
      }
      if (event.key === "c") {
        event.preventDefault();
        setCompose(true);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  return (
    <ToolbarViewsProvider
      value={{
        userId: "fictional-admin",
        save: async (view) => ({
          ...view,
          id: view.id ?? `fixture-view-${Date.now()}`,
          created_at: "",
          updated_at: "",
        }),
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Mail</h1>
            <Badge variant="outline">Native UI prototype</Badge>
            <span className="hidden text-xs text-muted-foreground lg:inline">
              admin@altitutor.com
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => globalPalette.open()}
            >
              <Search className="mr-2 h-4 w-4" />
              Commands
            </Button>
            <Button size="sm" onClick={() => setCommands(true)}>
              Preview email actions
            </Button>
            <Button size="sm" onClick={() => setCompose(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Compose
            </Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <aside className="shrink-0 border-b p-3 lg:w-40 lg:border-b-0 lg:border-r">
            <p className="mb-3 hidden px-2 text-[10px] uppercase tracking-widest text-muted-foreground lg:block">
              Microsoft folders · fixture
            </p>
            <div className="flex gap-1 overflow-auto lg:flex-col">
              {folders.map((name) => (
                <button
                  key={name}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs ${folder === name ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                  onClick={() => setFolder(name)}
                  onDragOver={(event) => {
                    if (
                      event.dataTransfer.types.includes(
                        "application/x-altitutor-prototype-email",
                      )
                    )
                      event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData(
                      "application/x-altitutor-prototype-email",
                    );
                    if (items.some((item) => item.id === id)) move(id, name);
                  }}
                >
                  <Folder className="h-3.5 w-3.5" />
                  {name}
                </button>
              ))}
            </div>
          </aside>
          <section className="min-w-0 flex-1 overflow-auto p-3 sm:p-5">
            <DataTableToolbar
              viewTarget="email"
              state={{ search, ...settings, page: 1, pageSize: 50 }}
              onSearchChange={setSearch}
              onFiltersChange={(filters) =>
                setSettings((all) => ({ ...all, filters }))
              }
              onSortChange={(sortBy, sortDirection) =>
                setSettings((all) => ({ ...all, sortBy, sortDirection }))
              }
              onGroupByChange={(groupBy) =>
                setSettings((all) => ({ ...all, groupBy }))
              }
              onVisibleColumnsChange={(visibleColumns) =>
                setSettings((all) => ({ ...all, visibleColumns }))
              }
              onQuickFilterApply={(view) =>
                setSettings(readViewSettings(view.config, defaults))
              }
              onReset={() => setSettings(defaults)}
              quickFilters={defaultViews}
              filterDefinitions={[
                {
                  key: "assignee",
                  label: "Assignee",
                  options: [
                    ...staff.map((name) => ({ value: name, label: name })),
                    { value: "unassigned", label: "Unassigned" },
                  ],
                },
              ]}
              sortOptions={[
                { key: "time", label: "Received" },
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
            <div className="mt-4 flex items-center justify-between px-3 pb-3">
              <h2 className="text-sm font-semibold">{folder}</h2>
              <span className="text-xs text-muted-foreground">
                {rows.length} conversations
              </span>
            </div>
            <div className="space-y-1">
              {rows.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "application/x-altitutor-prototype-email",
                      item.id,
                    );
                  }}
                  className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-3 ${selected === item.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => open(item)}
                    aria-label={`Open ${item.subject}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
                    />
                    <span
                      className={`w-28 shrink-0 truncate text-xs ${item.read ? "" : "font-semibold"}`}
                    >
                      {item.sender}
                    </span>
                    <span className="flex min-w-0 flex-1 gap-2 text-xs">
                      <span
                        className={`max-w-full shrink-0 truncate ${item.read ? "" : "font-medium"}`}
                      >
                        {item.subject}
                      </span>
                      {settings.visibleColumns.includes("preview") && (
                        <span className="hidden truncate text-muted-foreground xl:inline">
                          {item.preview}
                        </span>
                      )}
                    </span>
                  </button>
                  {settings.visibleColumns.includes("assignee") && (
                    <div className="w-28 shrink-0">
                      <Assignee
                        value={item.assignee}
                        onChange={(name) => assign(item, name)}
                      />
                    </div>
                  )}
                  {settings.visibleColumns.includes("time") && (
                    <span className="hidden w-14 shrink-0 text-right text-[11px] text-muted-foreground md:block">
                      {item.time}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!rows.length && (
              <p className="p-12 text-center text-xs text-muted-foreground">
                No fictional mail in this view.
              </p>
            )}
          </section>
          {thread && (
            <aside
              className="flex min-h-[650px] w-full shrink-0 flex-col border-l lg:w-[46%]"
              aria-label="Email thread tabs"
            >
              <div className="flex min-w-0 items-center gap-2 border-b p-2">
                <SegmentedControl
                  value={thread.id}
                  onValueChange={setActive}
                  size="sm"
                  aria-label="Open email threads"
                  options={tabs.map((id) => ({
                    value: id,
                    label: items.find((item) => item.id === id)?.subject ?? id,
                  }))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto shrink-0"
                  onClick={() => closeTab(thread.id)}
                  aria-label="Close email thread"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Archive thread"
                    onClick={() => move(thread.id, "Archive")}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mark thread unread"
                    onClick={() => patch(thread.id, { read: !thread.read })}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <SearchableSelect
                    items={folders}
                    value={thread.folder}
                    onValueChange={(target) => {
                      if (target) move(thread.id, target);
                    }}
                    getItemId={(name) => name}
                    getItemLabel={(name) => name}
                    searchPlaceholder="Search Microsoft folders…"
                    trigger={
                      <Button variant="outline" size="sm">
                        <Folder className="mr-1 h-3 w-3" />
                        Move
                      </Button>
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={activity}
                    onCheckedChange={(value) => setActivity(value === true)}
                  />
                  Show Activity
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
                <h2 className="mb-3 text-lg font-semibold">{thread.subject}</h2>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Assignee
                    value={thread.assignee}
                    onChange={(name) => assign(thread, name)}
                    pill
                  />
                  <Badge variant="outline">{thread.folder}</Badge>
                  {thread.kind && (
                    <Badge variant="outline">{thread.kind}</Badge>
                  )}
                </div>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    {thread.kind ? (
                      <button
                        className="text-sm font-medium hover:underline"
                        onClick={() => setContact(thread)}
                      >
                        {thread.sender}
                      </button>
                    ) : (
                      <SearchableSelect
                        items={[
                          "Link existing Student",
                          "Link existing Parent",
                          "Link existing Staff",
                          "Create contact",
                        ]}
                        value={null}
                        onValueChange={(action) => {
                          if (action) {
                            setContactAction(action);
                            setContact(thread);
                          }
                        }}
                        getItemId={(item) => item}
                        getItemLabel={(item) => item}
                        searchPlaceholder="Search contact actions…"
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-0 text-sm font-medium"
                          >
                            {thread.sender}
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        }
                      />
                    )}
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {thread.address} → admin@altitutor.com
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {thread.time}
                  </span>
                </div>
                {activity && (
                  <div className="mb-5 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Activity · fictional
                    </p>
                    <p className="mt-2">
                      Email received · directly linked participant
                    </p>
                    {linkedChild && thread.id === "alex" && (
                      <p className="mt-2">
                        Jane linked this email to Alex Morgan
                      </p>
                    )}
                    <p className="mt-2">
                      Enquiry actions use unified email context; no enquiry is
                      created automatically.
                    </p>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {thread.body}
                </p>
                {thread.id === "alex" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5"
                    onClick={() => setLinkedChild(!linkedChild)}
                  >
                    {linkedChild ? (
                      <Check className="mr-1 h-3 w-3" />
                    ) : (
                      <Plus className="mr-1 h-3 w-3" />
                    )}
                    {linkedChild
                      ? "Alex linked · Sam excluded"
                      : "Link relevant Student: Alex"}
                  </Button>
                )}
                {(replies[thread.id] ?? []).map((body, index) => (
                  <div key={index} className="mt-5 border-t pt-5">
                    <p className="mb-2 text-xs font-medium">
                      Altitutor Admin · Jane Smith · simulated
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t">
                <div className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
                  <SearchableSelect
                    items={["Reply", "Reply all", "Forward"]}
                    value={replyMode}
                    onValueChange={(mode) => {
                      if (mode === "Forward") {
                        setComposeTo("");
                        setComposeSubject(`Fwd: ${thread.subject}`);
                        setComposeBody(thread.body);
                        setCompose(true);
                      } else if (mode) setReplyMode(mode);
                    }}
                    getItemId={(mode) => mode}
                    getItemLabel={(mode) => mode}
                    searchPlaceholder="Search reply actions…"
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-0 text-xs"
                      >
                        <Reply className="mr-1 h-3 w-3" />
                        {replyMode}
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    }
                  />
                  to {thread.sender}
                </div>
                <div className="p-2">
                  <Textarea
                    aria-label="Email reply body"
                    placeholder="Write a reply…"
                    className="min-h-24 resize-none"
                    value={drafts[thread.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((all) => ({
                        ...all,
                        [thread.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === "Enter"
                      ) {
                        event.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <p className="px-3 pt-2 text-xs text-muted-foreground">
                    Jane Smith · Altitutor
                  </p>
                </div>
                {composerToolbar(
                  drafts[thread.id] ?? "",
                  (body) => setDrafts((all) => ({ ...all, [thread.id]: body })),
                  sendReply,
                )}
              </div>
            </aside>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <p role="status">{notice}</p>
          <SearchableSelect
            items={[
              "Outlook read",
              "Incoming follow-up",
              "Outlook staff reply",
            ]}
            value={null}
            onValueChange={(action) => {
              if (!thread || !action) return;
              if (action === "Outlook read") {
                patch(thread.id, { read: true });
                setNotice(
                  `Outlook read simulated. ${thread.assignee ?? "Unassigned"} stays responsible.`,
                );
              }
              if (action === "Incoming follow-up") {
                patch(thread.id, { read: false });
                setNotice(
                  thread.assignee
                    ? `${thread.assignee} remains assigned and was notified.`
                    : "Incoming follow-up remains unassigned.",
                );
              }
              if (action === "Outlook staff reply") {
                patch(thread.id, { assignee: null });
                setNotice("Outlook staff reply simulated; assignment cleared.");
              }
            }}
            getItemId={(item) => item}
            getItemLabel={(item) => item}
            disabled={!thread}
            searchPlaceholder="Search Outlook scenarios…"
            trigger={
              <Button
                size="sm"
                variant="ghost"
                disabled={!thread}
                className="h-6 text-[10px]"
              >
                Simulate Outlook
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            }
          />
        </footer>
        <AdminDialogShell
          open={compose}
          onClose={() => setCompose(false)}
          title="New email"
          subtitle="Fictional mail · nothing is delivered"
          fillHeight
          footer={composerToolbar(composeBody, setComposeBody, () => {
            if (!composeTo.trim() || !composeSubject.trim()) {
              setNotice("Add a recipient and subject.");
              return;
            }
            setItems((all) => [
              ...all,
              {
                ...initialMail[0],
                id: `new-${Date.now()}`,
                address: composeTo,
                sender: composeTo,
                subject: composeSubject,
                body: composeBody,
                preview: composeBody,
                folder: "Sent",
                assignee: null,
                read: true,
                time: "Now",
              },
            ]);
            setCompose(false);
            setComposeTo("");
            setComposeSubject("");
            setComposeBody("");
            setNotice("Simulated email in Sent. Nothing delivered.");
          })}
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              From Altitutor Admin &lt;admin@altitutor.com&gt;
            </p>
            <label className="block text-xs">
              To
              <Input
                aria-label="Email recipient"
                className="mt-1"
                value={composeTo}
                onChange={(event) => setComposeTo(event.target.value)}
              />
            </label>
            <label className="block text-xs">
              Subject
              <Input
                aria-label="Email subject"
                className="mt-1"
                value={composeSubject}
                onChange={(event) => setComposeSubject(event.target.value)}
              />
            </label>
            <Textarea
              aria-label="New email body"
              className="min-h-48"
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
              placeholder="Write a message…"
            />
            <p className="text-xs text-muted-foreground">
              Jane Smith
              <br />
              Altitutor
            </p>
          </div>
        </AdminDialogShell>
        <AdminDialogShell
          open={!!contact}
          onClose={() => {
            setContact(null);
            setContactAction(null);
          }}
          title={
            contactAction ??
            `${contact?.sender ?? ""} · ${contact?.kind ?? "Contact"}`
          }
          subtitle="Fictional contact navigation/link preview"
        >
          <div className="space-y-3 text-sm">
            <p>{contact?.address}</p>
            {contactAction ? (
              <SearchableSelect
                items={[
                  "Sam Morgan · Parent",
                  "Sam Lee · Student",
                  "Sam Walker · Staff",
                ]}
                value={null}
                onValueChange={(record) => {
                  if (record && contact) {
                    patch(contact.id, {
                      sender: record.split(" · ")[0],
                      kind: record.includes("Parent")
                        ? "Parent"
                        : record.includes("Student")
                          ? "Student"
                          : "Staff",
                    });
                    setContact(null);
                    setContactAction(null);
                    setNotice(
                      "Fictional contact linked. No record created or changed in the database.",
                    );
                  }
                }}
                getItemId={(item) => item}
                getItemLabel={(item) => item}
                searchPlaceholder="Search contacts…"
                placeholder="Choose fixture contact"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Implementation opens this person through the existing
                Student/Parent/Staff navigation. This fixture never looks up a
                real person.
              </p>
            )}
          </div>
        </AdminDialogShell>
        <AdminDialogShell
          open={commands}
          onClose={() => setCommands(false)}
          title="Email actions · native palette preview"
          subtitle="Same PaletteBrowser; production registration uses existing record/page scopes"
          bodyClassName="h-[520px] p-0"
        >
          <PaletteBrowser
            isOpen={commands}
            onClose={() => setCommands(false)}
            onEntitySelected={() => {}}
            pages={[]}
            searchEntities={async () => ({ results: [], hasMore: false })}
            commands={[
              {
                id: "mail-compose",
                title: "Compose email",
                icon: Plus,
                action: () => setCompose(true),
              },
              {
                id: "mail-reply",
                title: "Reply to selected email",
                icon: Reply,
                disabled: !thread,
                action: () =>
                  document
                    .querySelector<HTMLTextAreaElement>(
                      '[aria-label="Email reply body"]',
                    )
                    ?.focus(),
              },
              {
                id: "mail-archive",
                title: "Archive selected email",
                icon: Archive,
                disabled: !thread,
                action: () => {
                  if (thread) move(thread.id, "Archive");
                },
              },
            ]}
          />
        </AdminDialogShell>
      </div>
    </ToolbarViewsProvider>
  );
}
