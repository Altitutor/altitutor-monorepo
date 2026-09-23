"use client";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Check, ChevronDown, Filter, MessageSquare } from "lucide-react";
import { Composer } from "@/features/messages/components/Composer";
import {
  MessageThread,
  type ThreadFeedEntry,
} from "@/features/messages/components/MessageThread";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { useStudentActivity } from "@/features/activity/hooks/useActivityEvents";
import { useStudentInviteData } from "@/features/students/hooks/useStudentInviteData";
import {
  getStudentRegistrationInviteMessageForClient,
  getSenderNameFromStaff,
} from "@/features/messages/api/systemTemplates";
import { useCurrentStaff } from "@/shared/hooks";
import {
  useJourneyConversations,
  useJourneyMessages,
  useJourneyEmails,
  useMailboxStatus,
} from "../api/communication";
import type { Journey } from "../lib/model";

type Purpose = "registration_link" | "ucat_link" | "followup";

const FEED_SOURCES = [
  ["events", "Activity / events"],
  ["student", "Student texts"],
  ["parent", "Parent texts"],
  ["group", "Group texts"],
  ["email", "Emails"],
] as const;
export const JourneyCommunication = forwardRef<
  { prepare: (purpose: Purpose) => void },
  { journey: Journey; onRefresh: () => void }
>(function JourneyCommunication({ journey, onRefresh }, ref) {
  const [sources, setSources] = useState<string[]>(
    FEED_SOURCES.map(([value]) => value),
  );
  const emails = useJourneyEmails(journey.id);
  const mailbox = useMailboxStatus();
  const [destination, setDestination] = useState("");
  const [draft, setDraft] = useState("");
  const [purpose, setPurpose] = useState<Purpose>();
  const [error, setError] = useState("");
  const { data: context, error: contextError } =
    useJourneyConversations(journey);
  const conversations = useMemo(() => context?.conversations ?? [], [context]);
  const messages = useJourneyMessages(conversations);
  const activity = useStudentActivity(journey.student_id);
  const inviteQuery = useStudentInviteData(
    journey.student_id ?? "",
    "registration",
    Boolean(journey.student_id),
  );
  const invite = inviteQuery.data;
  const { data: staff } = useCurrentStaff();
  const contacts = context?.contacts ?? [];
  const selected =
    destination ||
    contacts.find((c) => c.kind === "parent")?.id ||
    contacts[0]?.id ||
    "";
  const contact = contacts.find((c) => c.id === selected);
  const recipients = useMemo(
    () => [
      ...contacts.map((person) => ({
        id: person.id,
        label: person.label,
        detail: person.phone_e164 || person.kind,
      })),
      ...conversations
        .filter((conversation) => conversation.is_group_chat)
        .map((conversation) => ({
          id: conversation.id,
          label: conversation.group_chat_name || "Existing group",
          detail: "Group",
        })),
    ],
    [contacts, conversations],
  );
  const selectedRecipient = recipients.find((recipient) => recipient.id === selected);
  const group = conversations.find((c) => c.id === selected && c.is_group_chat);
  function sourceFor(id: string) {
    const c = conversations.find((c) => c.id === id);
    return c?.is_group_chat
      ? "group"
      : (contacts.find((p) => p.id === c?.contact_id)?.kind ?? "student");
  }
  const visible = (messages.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (m) => sources.includes(sourceFor(m.conversation_id)),
  );
  const entries: ThreadFeedEntry[] = sources.includes("events")
    ? (activity.data?.events ?? []).map((event) => ({
        id: `event:${event.id}`,
        at: event.effective_at,
        content: (
          <ActivityFeed
            chronological
            data={{ ...activity.data!, events: [event] }}
          />
        ),
      }))
    : [];
  if (sources.includes("email"))
    for (const email of emails.data?.pages.flatMap((p) => p.items) ?? [])
      entries.push({
        id: `email:${email.id}`,
        at: email.occurred_at,
        content: (
          <article className="border rounded-lg p-3 text-sm space-y-1">
            <div className="text-xs text-muted-foreground">
              Email · {email.sender} → {email.recipients.join(", ")} ·{" "}
              {new Date(email.occurred_at).toLocaleString("en-AU")}
            </div>
            <strong>{email.subject}</strong>
            <p className="whitespace-pre-wrap break-words">{email.body_text}</p>
          </article>
        ),
      });
  async function prepare(kind: Purpose) {
    setError("");
    try {
      if (kind === "registration_link") {
        if (!journey.student_id)
          throw new Error("Link a student before preparing registration.");
        let inviteUrl = invite?.inviteUrl;
        if (!inviteUrl) {
          const response = await fetch(
            "/api/students/send-registration-invite",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ studentId: journey.student_id }),
            },
          );
          if (!response.ok)
            throw new Error("Could not prepare the registration link.");
          inviteUrl = (await inviteQuery.refetch()).data?.inviteUrl;
        }
        if (!inviteUrl)
          throw new Error("Registration link is not available yet.");
        setDraft(
          await getStudentRegistrationInviteMessageForClient({
            firstName: contact?.label.split(" ")[0] ?? "there",
            inviteUrl,
            studentName: journey.label,
            senderName: getSenderNameFromStaff(staff),
          }),
        );
      } else if (kind === "ucat_link")
        setDraft(
          `Hi ${contact?.label.split(" ")[0] ?? "there"}, you can sign up for UCAT here: https://ucat.altitutor.com/signup. If you already have an account, please sign in instead.`,
        );
      else
        setDraft(
          `Hi ${contact?.label.split(" ")[0] ?? "there"}, just checking whether you need help with ${journey.label}’s next step. Please let us know.`,
        );
      setPurpose(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare message.");
    }
  }
  useImperativeHandle(ref, () => ({
    prepare: (kind) => {
      void prepare(kind);
    },
  }));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-medium">Message</span>
          {recipients.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 max-w-full">
                  <MessageSquare className="mr-1 h-3 w-3 shrink-0" />
                  <span className="truncate text-xs">
                    {selectedRecipient?.label ?? "Select phone"}
                  </span>
                  {selectedRecipient?.detail ? (
                    <span className="ml-1 truncate text-xs text-muted-foreground">
                      • {selectedRecipient.detail}
                    </span>
                  ) : null}
                  <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {recipients.map((recipient) => (
                  <DropdownMenuItem
                    key={recipient.id}
                    onClick={() => {
                      setDestination(recipient.id);
                      setDraft("");
                      setPurpose(undefined);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {recipient.label}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {recipient.detail}
                        </span>
                      </div>
                    </div>
                    {selected === recipient.id ? (
                      <Check className="ml-2 h-4 w-4 shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="truncate text-xs text-muted-foreground">
              No phone number
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 shrink-0">
              <Filter className="mr-1 h-3 w-3" />
              <span className="text-xs">Filter</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {FEED_SOURCES.map(([value, label]) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={sources.includes(value)}
                onCheckedChange={(checked) =>
                  setSources((current) =>
                    checked
                      ? current.includes(value)
                        ? current
                        : [...current, value]
                      : current.filter((item) => item !== value),
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {sources.includes("email") && !mailbox.data?.length && (
        <p className="flex-shrink-0 px-3 py-2 text-xs text-muted-foreground">
          Microsoft 365 sync is awaiting configuration. Emails will appear here
          after connection.
        </p>
      )}
      {(error || contextError || messages.error || activity.error) && (
        <p role="alert" className="flex-shrink-0 px-3 py-2 text-sm text-destructive">
          {error ||
            contextError?.message ||
            messages.error?.message ||
            activity.error?.message}
        </p>
      )}
      <MessageThread
        hideAddIssueHover
        feed={{
          key: journey.id,
          messages: visible,
          entries,
          hasMore: Boolean(
            messages.hasNextPage || activity.hasNextPage || emails.hasNextPage,
          ),
          loadMore: () => {
            if (messages.hasNextPage) void messages.fetchNextPage();
            if (activity.hasNextPage) activity.fetchNextPage();
            if (emails.hasNextPage) void emails.fetchNextPage();
          },
          labelForConversation: (id) => {
            const c = conversations.find((c) => c.id === id);
            return c?.is_group_chat
              ? (c.group_chat_name ?? "Existing group")
              : `${contacts.find((p) => p.id === c?.contact_id)?.label ?? "Contact"} · ${sourceFor(id)} text`;
          },
        }}
      />
      {selected ? (
        <Composer
          key={selected}
          contactId={contact?.id ?? null}
          conversationId={group?.id}
          groupChatId={group?.group_chat_id}
          draft={draft}
          onDraftChange={setDraft}
          onDraftClear={() => setDraft("")}
          onboarding={purpose ? { journeyId: journey.id, purpose } : undefined}
          onQueued={() => {
            setPurpose(undefined);
            void messages.refetch();
            onRefresh();
          }}
        />
      ) : (
        <p className="flex-shrink-0 border-t p-4 text-sm text-muted-foreground">
          Link a student or enquiry contact with a phone number to send a text.
        </p>
      )}
    </div>
  );
});
