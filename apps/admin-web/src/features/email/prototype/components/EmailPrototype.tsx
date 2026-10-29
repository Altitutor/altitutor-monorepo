"use client";

// Throwaway: three structurally different mail layouts on /email-prototype?variant=A|B|C.
// Actual portal shell/auth; all mail, mutations and notifications below are fictional in-memory state.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Bell,
  ChevronRight,
  FileText,
  Inbox,
  Mail,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Button, Input, Textarea } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { PrototypeSwitcher, type MailVariant } from "./PrototypeSwitcher";

type Folder = "Inbox" | "Sent" | "Drafts" | "Archive";
type FixtureMail = {
  id: string;
  person: string;
  initials: string;
  address: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  folder: Folder;
  read: boolean;
  assignee: string;
  kind: "parent" | "student" | "other";
  operational?: boolean;
  attachment?: string;
};
const seed: FixtureMail[] = [
  {
    id: "alex",
    person: "Taylor Morgan",
    initials: "TM",
    address: "taylor@example.test",
    subject: "Could Alex move to Saturday?",
    preview:
      "Our basketball schedule has changed. Is there room in the Saturday class?",
    body: "Hi team,\n\nAlex's basketball training has moved to Wednesday evenings. Could we move his chemistry class to Saturday instead?\n\nHe is happy to start next week if there is a place available.\n\nThanks,\nTaylor",
    time: "10:42",
    folder: "Inbox",
    read: false,
    assignee: "Jane Smith",
    kind: "parent",
  },
  {
    id: "absence",
    person: "Priya Shah",
    initials: "PS",
    address: "priya@example.test",
    subject: "Absent this evening",
    preview: "Maya is feeling unwell and won't be able to make it tonight.",
    body: "Hi Altitutor,\n\nMaya is unwell and won't be able to attend this evening. Please let her tutor know.\n\nThank you,\nPriya",
    time: "10:18",
    folder: "Inbox",
    read: false,
    assignee: "",
    kind: "parent",
  },
  {
    id: "work",
    person: "Jordan Lee",
    initials: "JL",
    address: "jordan@example.test",
    subject: "Homework for next week",
    preview: "Here is the worksheet I mentioned after class yesterday.",
    body: "Hi,\n\nCould you pass this worksheet on to my chemistry tutor? These are the questions I got stuck on.\n\nThanks,\nJordan",
    time: "09:51",
    folder: "Inbox",
    read: true,
    assignee: "",
    kind: "student",
    attachment: "chemistry-worksheet.pdf",
  },
  {
    id: "supplies",
    person: "Campus Supplies",
    initials: "CS",
    address: "orders@example.test",
    subject: "Your stationery order is on its way",
    preview: "Your order will arrive tomorrow between 9 am and 1 pm.",
    body: "Your stationery order has been dispatched.\n\nDelivery is scheduled for tomorrow between 9 am and 1 pm.\n\nCampus Supplies",
    time: "09:06",
    folder: "Inbox",
    read: true,
    assignee: "",
    kind: "other",
  },
  {
    id: "enrol",
    person: "Taylor Morgan",
    initials: "TM",
    address: "taylor@example.test",
    subject: "Alex's enrolment confirmation",
    preview:
      "Alex is enrolled in Wednesday Chemistry. Your class details are below.",
    body: "Hi Taylor,\n\nAlex is enrolled in Wednesday Chemistry. This is a fictional example of an operational email that belongs in shared Sent history and relevant Activity.\n\nThe Altitutor team",
    time: "Yesterday",
    folder: "Sent",
    read: true,
    assignee: "",
    kind: "parent",
    operational: true,
  },
  {
    id: "invoice",
    person: "Priya Shah",
    initials: "PS",
    address: "priya@example.test",
    subject: "Your tutoring invoice is ready",
    preview: "View your invoice and upcoming session details.",
    body: "Hi Priya,\n\nYour tutoring invoice is ready.\n\nThis fictional operational email is visible in shared Sent and the directly relevant business history.\n\nAltitutor",
    time: "Yesterday",
    folder: "Sent",
    read: true,
    assignee: "",
    kind: "parent",
    operational: true,
  },
];

type Model = ReturnType<typeof useMailModel>;
function useMailModel() {
  const [items, setItems] = useState<FixtureMail[]>(seed);
  const [selectedId, setSelectedId] = useState("alex");
  const [folder, setFolder] = useState<Folder>("Inbox");
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState(false);
  const [linked, setLinked] = useState(false);
  const [notice, setNotice] = useState(
    "Fictional mailbox ready. Reads and responsibility are separate.",
  );
  const [notifications, setNotifications] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState(false);
  const [newMail, setNewMail] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [settings, setSettings] = useState(false);
  const [signature, setSignature] = useState("Jane Smith\nAltitutor");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const rows = (
    folder === "Drafts"
      ? items
          .filter((item) => drafts[item.id]?.trim())
          .map((item) => ({
            ...item,
            folder: "Drafts" as Folder,
            preview: drafts[item.id],
          }))
      : items.filter((item) => item.folder === folder)
  ).filter((item) =>
    `${item.person} ${item.subject} ${item.body}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function patch(id: string, values: Partial<FixtureMail>) {
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  function choose(item: FixtureMail) {
    setSelectedId(item.id);
    patch(item.id, { read: true });
    setFocus(true);
    setReplying(item.folder === "Drafts");
  }
  function assign(name: string) {
    patch(selected.id, { assignee: name });
    if (name) {
      setNotifications((all) => [
        ...all,
        `${name}: assigned “${selected.subject}”.`,
      ]);
      setNotice(
        `${name} was notified. Reading this thread will keep the assignment.`,
      );
    } else setNotice("Thread unassigned.");
  }
  function move(value: Folder) {
    patch(selected.id, { folder: value });
    setNotice(
      `Moved to ${value}. Outlook would reflect the same mailbox move after synchronization.`,
    );
    setFocus(false);
  }
  function simulate(action: string) {
    if (action === "read") {
      patch(selected.id, { read: true });
      setNotice(
        "Simulated Outlook read: shared read state changed; responsibility stays.",
      );
    }
    if (action === "incoming") {
      patch(selected.id, { read: false });
      if (selected.assignee)
        setNotifications((all) => [
          ...all,
          `${selected.assignee}: another email arrived in “${selected.subject}”.`,
        ]);
      setNotice(
        selected.assignee
          ? `Follow-up arrived. ${selected.assignee} remains responsible and was notified.`
          : "Follow-up arrived. This thread remains unassigned.",
      );
    }
    if (action === "reply") {
      patch(selected.id, { assignee: "" });
      setNotice(
        "Simulated staff reply in Outlook: responsibility cleared. This does not send real mail.",
      );
    }
  }
  function sendReply() {
    const body = drafts[selected.id]?.trim();
    if (!body) return;
    patch(selected.id, { assignee: "" });
    setItems((all) => [
      ...all,
      {
        ...selected,
        id: `reply-${all.length}`,
        subject: `Re: ${selected.subject}`,
        body: `${body}\n\n${signature}`,
        preview: body,
        folder: "Sent",
        read: true,
        assignee: "",
        time: "Now",
        operational: false,
      },
    ]);
    setDrafts((all) => ({ ...all, [selected.id]: "" }));
    setReplying(false);
    setNotice(
      "Fictional reply added to Sent; responsibility cleared. Nothing was delivered.",
    );
  }
  function sendNew() {
    if (!to.trim() || !subject.trim() || !newBody.trim()) return;
    setItems((all) => [
      ...all,
      {
        id: `new-${all.length}`,
        person: to,
        address: to,
        initials: "TO",
        subject,
        preview: newBody,
        body: `${newBody}\n\n${signature}`,
        time: "Now",
        folder: "Sent",
        read: true,
        assignee: "",
        kind: "other",
      },
    ]);
    setNewMail(false);
    setTo("");
    setSubject("");
    setNewBody("");
    setNotice("Fictional new email added to Sent. Nothing was delivered.");
  }
  return {
    items,
    selected,
    rows,
    folder,
    setFolder,
    search,
    setSearch,
    focus,
    setFocus,
    linked,
    setLinked,
    notice,
    setNotice,
    notifications,
    drafts,
    setDrafts,
    replying,
    setReplying,
    choose,
    patch,
    assign,
    move,
    simulate,
    sendReply,
    newMail,
    setNewMail,
    to,
    setTo,
    subject,
    setSubject,
    newBody,
    setNewBody,
    sendNew,
    settings,
    setSettings,
    signature,
    setSignature,
  };
}

function FolderButton({ value, model }: { value: Folder; model: Model }) {
  const Icon =
    value === "Inbox"
      ? Inbox
      : value === "Sent"
        ? Send
        : value === "Drafts"
          ? FileText
          : Archive;
  const count =
    value === "Drafts"
      ? Object.values(model.drafts).filter(Boolean).length
      : model.items.filter((item) => item.folder === value && !item.read)
          .length;
  return (
    <button
      onClick={() => {
        model.setFolder(value);
        model.setFocus(false);
      }}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${model.folder === value ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
    >
      <Icon className="h-4 w-4" />
      {value}
      {count > 0 && <span className="ml-auto text-xs">{count}</span>}
    </button>
  );
}

function MailRow({
  item,
  model,
  compact = false,
}: {
  item: FixtureMail;
  model: Model;
  compact?: boolean;
}) {
  return (
    <button
      onClick={() => model.choose(item)}
      className={`w-full border-b px-4 py-4 text-left transition-colors hover:bg-muted/50 ${model.selected.id === item.id ? "bg-primary/5" : "bg-card"}`}
      aria-label={`Open ${item.subject}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
        />
        <span
          className={`min-w-0 flex-1 truncate text-sm ${item.read ? "font-normal" : "font-semibold"}`}
        >
          {item.person}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {item.time}
        </span>
      </div>
      <div
        className={`mt-1 truncate pl-3.5 text-sm ${item.read ? "" : "font-medium"}`}
      >
        {item.subject}
      </div>
      {!compact && (
        <p className="mt-1 truncate pl-3.5 text-xs text-muted-foreground">
          {item.preview}
        </p>
      )}
      {(item.assignee || item.operational) && (
        <div className="mt-2 flex gap-2 pl-3.5">
          {item.assignee && (
            <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary">
              {item.assignee}
            </span>
          )}
          {item.operational && (
            <span className="text-[10px] text-muted-foreground">
              Automatic · operational
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function Context({ model, wide = false }: { model: Model; wide?: boolean }) {
  const item = model.selected;
  return (
    <div className={`space-y-5 ${wide ? "" : "border-t pt-4"}`}>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Next reply
        </p>
        <label className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Responsible staff member</span>
          <select
            aria-label="Responsible staff member"
            value={item.assignee}
            onChange={(event) => model.assign(event.target.value)}
            className="min-w-0 flex-1 rounded-md border bg-card p-2 text-xs"
          >
            <option value="">Unassigned</option>
            <option>Jane Smith</option>
            <option>Chris Walker</option>
          </select>
        </label>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Reads preserve responsibility. Any staff reply clears it.
        </p>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Linked context
        </p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 rounded-md border p-2">
            <span>
              {item.kind === "parent"
                ? `${item.person} · Parent`
                : item.kind === "student"
                  ? `${item.person} · Student`
                  : "No matched participant"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {item.kind === "other" ? "Unlinked" : "Automatic"}
            </span>
          </div>
          {item.id === "alex" && (
            <button
              className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left hover:bg-muted"
              onClick={() => model.setLinked(!model.linked)}
            >
              <span>
                {model.linked
                  ? "Alex Morgan · Student"
                  : "Link Alex as relevant Student"}
              </span>
              {model.linked ? (
                <X className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {model.linked && item.id === "alex"
            ? "Appears on Taylor and Alex. Sam is not linked."
            : "Children are linked explicitly, not inferred from a Parent."}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Related Activity · fictional
        </p>
        <p className="border-l-2 pl-3 text-xs text-muted-foreground">
          {item.operational
            ? "Operational email sent · linked to its business records"
            : "Email received · direct participant matched"}
        </p>
        {model.linked && item.id === "alex" && (
          <p className="mt-2 border-l-2 pl-3 text-xs text-muted-foreground">
            Jane linked this thread to Alex Morgan
          </p>
        )}
      </div>
    </div>
  );
}

function Reader({
  model,
  context = true,
}: {
  model: Model;
  context?: boolean;
}) {
  const item = model.selected;
  const draft = model.drafts[item.id] ?? "";
  return (
    <article className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to inbox"
            onClick={() => model.setFocus(false)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archive thread"
            onClick={() => model.move("Archive")}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={item.read ? "Mark thread unread" : "Mark thread read"}
            onClick={() => model.patch(item.id, { read: !item.read })}
          >
            {item.read ? (
              <Mail className="h-4 w-4" />
            ) : (
              <MailOpen className="h-4 w-4" />
            )}
          </Button>
          <select
            aria-label="Move thread to folder"
            className="max-w-32 rounded-md border bg-card p-1.5 text-xs"
            value={item.folder}
            onChange={(event) => model.move(event.target.value as Folder)}
          >
            {(["Inbox", "Sent", "Drafts", "Archive"] as Folder[]).map(
              (folder) => (
                <option key={folder}>{folder}</option>
              ),
            )}
          </select>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {item.read ? "Read" : "Unread"} · {item.assignee || "Unassigned"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-7">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">
          {item.subject}
        </h2>
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {item.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {item.folder === "Sent" ? "Altitutor Admin" : item.person}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              {item.folder === "Sent"
                ? `To ${item.address}`
                : `${item.address} → admin@altitutor.com`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{item.time}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7">{item.body}</p>
        {item.attachment && (
          <button
            onClick={() =>
              model.setNotice(
                "Fictional attachment preview: chemistry-worksheet.pdf. No file is downloaded.",
              )
            }
            className="mt-5 flex items-center gap-2 rounded-lg border p-3 text-xs"
          >
            <Paperclip className="h-4 w-4" />
            {item.attachment}
          </button>
        )}
        <div className="mt-8 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => model.setReplying(true)}
          >
            Reply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              model.setReplying(true);
              model.setNotice(
                "Reply all · preview recipients are the original participants. No live addresses are used.",
              );
            }}
          >
            Reply all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              model.setNewMail(true);
              model.setSubject(`Fwd: ${item.subject}`);
              model.setNewBody(item.body);
            }}
          >
            Forward
          </Button>
        </div>
        {model.replying && (
          <div className="mt-4 rounded-xl border p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Altitutor Admin &lt;admin@altitutor.com&gt; → {item.address}
            </p>
            <label className="mb-3 block">
              <span className="sr-only">Email template</span>
              <select
                aria-label="Email template"
                value=""
                onChange={(event) => {
                  model.setDrafts((all) => ({
                    ...all,
                    [item.id]: event.target.value,
                  }));
                }}
                className="rounded-md border bg-card p-1.5 text-xs"
              >
                <option value="">Insert a template…</option>
                <option
                  value={
                    "Hi Taylor,\n\nWe can move Alex to the Saturday class. I will confirm the details shortly."
                  }
                >
                  Class change follow-up
                </option>
                <option
                  value={
                    "Hi,\n\nThanks for letting us know. We have passed this on to the tutor."
                  }
                >
                  Absence acknowledgement
                </option>
              </select>
            </label>
            <Textarea
              aria-label="Reply body"
              className="min-h-32 border-0 p-0 shadow-none focus-visible:ring-0"
              placeholder="Write your reply…"
              value={draft}
              onChange={(event) =>
                model.setDrafts((all) => ({
                  ...all,
                  [item.id]: event.target.value,
                }))
              }
            />
            <p className="mt-4 whitespace-pre-line text-xs text-muted-foreground">
              {model.signature}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                size="sm"
                disabled={!draft.trim()}
                onClick={model.sendReply}
              >
                <Send className="mr-2 h-3 w-3" />
                Send simulated reply
              </Button>
              <span className="text-[10px] text-muted-foreground">
                Draft held in this tab only
              </span>
            </div>
          </div>
        )}
        {context && (
          <div className="mt-7">
            <Context model={model} />
          </div>
        )}
      </div>
    </article>
  );
}

export function VariantA({ model }: { model: Model }) {
  return (
    <div className="grid min-h-[660px] flex-1 overflow-hidden rounded-xl border bg-card md:grid-cols-[135px_290px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-muted/20 p-2 md:block">
        <p className="px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Mailbox
        </p>
        {(["Inbox", "Sent", "Drafts", "Archive"] as Folder[]).map((folder) => (
          <FolderButton key={folder} value={folder} model={model} />
        ))}
        <div className="mt-8 px-3 text-[10px] text-muted-foreground">
          admin@altitutor.com
          <br />
          Shared mailbox
        </div>
      </aside>
      <section className={`border-r ${model.focus ? "hidden md:block" : ""}`}>
        <div className="border-b p-3">
          <Input
            aria-label="Search email"
            value={model.search}
            onChange={(event) => model.setSearch(event.target.value)}
            placeholder="Search email…"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center justify-between border-b px-4 py-3 text-xs">
          <strong>{model.folder}</strong>
          <span className="text-muted-foreground">
            {model.rows.length} threads
          </span>
        </div>
        {model.rows.map((item) => (
          <MailRow key={item.id} item={item} model={model} />
        ))}
        {!model.rows.length && (
          <p className="p-5 text-xs text-muted-foreground">
            No fictional mail here.
          </p>
        )}
      </section>
      <div className={`min-w-0 ${model.focus ? "flex" : "hidden md:flex"}`}>
        <Reader model={model} />
      </div>
    </div>
  );
}

export function VariantB({ model }: { model: Model }) {
  return (
    <div className="min-h-[660px] flex-1 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        {(["Inbox", "Sent", "Drafts", "Archive"] as Folder[]).map((folder) => (
          <div className="w-auto" key={folder}>
            <FolderButton value={folder} model={model} />
          </div>
        ))}
        <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">
          J / K move · Enter opens · Esc returns
        </span>
      </div>
      {model.focus ? (
        <div className="mx-auto flex min-h-[600px] max-w-3xl">
          <Reader model={model} />
        </div>
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-7 sm:px-8">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Wednesday, 28 October · Fictional
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {model.folder}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {model.rows.filter((item) => !item.read).length} unread
            </span>
          </div>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search email"
              className="pl-9"
              placeholder="Find a sender, subject or message…"
              value={model.search}
              onChange={(event) => model.setSearch(event.target.value)}
            />
          </div>
          <div className="border-t">
            {model.rows.map((item) => (
              <MailRow key={item.id} item={item} model={model} compact />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Open a thread to focus on one conversation. Context and replies stay
            with the message.
          </p>
        </div>
      )}
    </div>
  );
}

export function VariantC({ model }: { model: Model }) {
  return (
    <div className="grid min-h-[660px] flex-1 gap-4 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
      <aside
        className={`rounded-xl border bg-card ${model.focus ? "hidden lg:block" : ""}`}
      >
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">People & requests</h2>
          <Input
            aria-label="Search email"
            className="mt-3 h-8 text-xs"
            placeholder="Find correspondence…"
            value={model.search}
            onChange={(event) => model.setSearch(event.target.value)}
          />
        </div>
        <div className="flex border-b p-1 lg:block">
          {(["Inbox", "Sent", "Archive"] as Folder[]).map((folder) => (
            <FolderButton key={folder} value={folder} model={model} />
          ))}
        </div>
        {model.rows.map((item) => (
          <button
            key={item.id}
            onClick={() => model.choose(item)}
            className={`w-full border-b p-4 text-left hover:bg-muted/50 ${model.selected.id === item.id ? "bg-primary/5" : ""}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px]">
                {item.initials}
              </span>
              <span className="truncate text-xs font-medium">
                {item.person}
              </span>
              {!item.read && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </div>
            <p className="text-xs">{item.subject}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {item.assignee || "Unassigned"} ·{" "}
              {item.kind === "other" ? "Other mail" : item.kind}
            </p>
          </button>
        ))}
      </aside>
      <div
        className={`min-w-0 overflow-hidden rounded-xl border ${model.focus ? "flex" : "hidden lg:flex"}`}
      >
        <Reader model={model} context={false} />
      </div>
      <aside className="rounded-xl border bg-card p-4">
        <h3 className="mb-5 text-sm font-semibold">People & responsibility</h3>
        <Context model={model} wide />
      </aside>
    </div>
  );
}

export function EmailPrototype() {
  const search = useSearchParams();
  const variant: MailVariant =
    search.get("variant") === "B"
      ? "B"
      : search.get("variant") === "C"
        ? "C"
        : "A";
  const model = useMailModel();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input,textarea,select,[contenteditable=true],[role=dialog]",
        )
      )
        return;
      if (event.key === "Escape") model.setFocus(false);
      if (variant !== "B") return;
      const index = model.rows.findIndex(
        (item) => item.id === model.selected.id,
      );
      if (event.key === "j" || event.key === "k") {
        const item =
          model.rows[
            (Math.max(0, index) +
              (event.key === "j" ? 1 : -1) +
              model.rows.length) %
              model.rows.length
          ];
        if (item) {
          model.choose(item);
          model.setFocus(false);
        }
      }
      if (event.key === "Enter") model.setFocus(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, model]);
  if (variant === "B") {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col pb-16">
        <iframe
          title="Mail prototype B v2 · fictional"
          src="/email-prototype/focus?embedded=1"
          className="min-h-[760px] w-full flex-1 border-0"
        />
        <PrototypeSwitcher variant={variant} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Mail</h1>
            <Badge variant="outline" className="text-[10px]">
              Prototype · fictional
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            admin@altitutor.com · actual admin shell · no live mailbox connected
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => model.setSettings(true)}
          >
            <MoreHorizontal className="mr-1 h-4 w-4" />
            Templates & signature
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              model.setNotice(
                model.notifications.length
                  ? model.notifications.join(" · ")
                  : "No simulated assignment notifications yet.",
              )
            }
          >
            <Bell className="mr-1 h-4 w-4" />
            {model.notifications.length}
          </Button>
          <Button size="sm" onClick={() => model.setNewMail(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Compose
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/25 px-3 py-2">
        <p
          role="status"
          className="min-w-0 flex-1 text-[11px] text-muted-foreground"
        >
          {model.notice}
        </p>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Scenario</span>
          <select
            aria-label="Simulate an Outlook action"
            value=""
            onChange={(event) => model.simulate(event.target.value)}
            className="max-w-44 rounded border bg-card p-1"
          >
            <option value="">Simulate Outlook…</option>
            <option value="read">Read selected thread</option>
            <option value="incoming">Parent sends follow-up</option>
            <option value="reply">Another staff member replies</option>
          </select>
        </label>
      </div>
      {variant === "A" ? (
        <VariantA model={model} />
      ) : (
        <VariantC model={model} />
      )}
      <PrototypeSwitcher variant={variant} />
      <AdminDialogShell
        open={model.newMail}
        onClose={() => model.setNewMail(false)}
        title="New email · fictional"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              No real mail will be sent.
            </span>
            <Button
              disabled={
                !model.to.trim() ||
                !model.subject.trim() ||
                !model.newBody.trim()
              }
              onClick={model.sendNew}
            >
              <Send className="mr-2 h-4 w-4" />
              Send simulated email
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            From Altitutor Admin &lt;admin@altitutor.com&gt;
          </p>
          <label className="block text-xs">
            To
            <Input
              aria-label="New email recipient"
              className="mt-1"
              value={model.to}
              onChange={(event) => model.setTo(event.target.value)}
              placeholder="person@example.test"
            />
          </label>
          <label className="block text-xs">
            Subject
            <Input
              aria-label="New email subject"
              className="mt-1"
              value={model.subject}
              onChange={(event) => model.setSubject(event.target.value)}
            />
          </label>
          <Textarea
            aria-label="New email body"
            className="min-h-52"
            value={model.newBody}
            onChange={(event) => model.setNewBody(event.target.value)}
            placeholder="Write a message…"
          />
          <p className="whitespace-pre-line text-xs text-muted-foreground">
            {model.signature}
          </p>
        </div>
      </AdminDialogShell>
      <AdminDialogShell
        open={model.settings}
        onClose={() => model.setSettings(false)}
        title="Templates & signature · fictional"
      >
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-medium">Shared templates</h3>
            <p className="rounded-lg border p-3 text-sm">
              Class change follow-up{" "}
              <ChevronRight className="float-right h-4 w-4" />
            </p>
            <p className="mt-2 rounded-lg border p-3 text-sm">
              Absence acknowledgement{" "}
              <ChevronRight className="float-right h-4 w-4" />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Templates insert editable content into the reply composer.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Your signature</h3>
            <Textarea
              value={model.signature}
              onChange={(event) => model.setSignature(event.target.value)}
              aria-label="Staff email signature preview"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Changes apply within this prototype tab; refresh restores
              defaults.
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-xs">
            The shared From identity stays Altitutor Admin. Account-security and
            UCAT campaigns retain their existing authorship.
          </div>
        </div>
      </AdminDialogShell>
    </div>
  );
}
