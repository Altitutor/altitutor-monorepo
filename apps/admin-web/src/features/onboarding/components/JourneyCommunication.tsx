"use client";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Button, SegmentedControl, Textarea } from "@altitutor/ui";
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
export const JourneyCommunication = forwardRef<
  { prepare: (purpose: Purpose) => void },
  { journey: Journey; onRefresh: () => void }
>(function JourneyCommunication({ journey, onRefresh }, ref) {
  const [sources, setSources] = useState([
    "events",
    "student",
    "parent",
    "group",
    "email",
  ]);
  const [channel, setChannel] = useState<"text" | "email">("text");
  const [emailTo, setEmailTo] = useState(journey.enquiry_email ?? "");
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
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label="Feed sources"
      >
        {[
          ["events", "Activity / events"],
          ["student", "Student texts"],
          ["parent", "Parent texts"],
          ["group", "Group texts"],
          ["email", "Emails"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={sources.includes(value) ? "secondary" : "outline"}
            aria-pressed={sources.includes(value)}
            onClick={() =>
              setSources((s) =>
                s.includes(value)
                  ? s.filter((v) => v !== value)
                  : [...s, value],
              )
            }
          >
            {label}
          </Button>
        ))}
      </div>
      {sources.includes("email") && !mailbox.data?.length && (
        <p className="text-xs text-muted-foreground">
          Microsoft 365 sync is awaiting configuration. Emails will appear here
          after connection.
        </p>
      )}
      {(error || contextError || messages.error || activity.error) && (
        <p role="alert" className="text-destructive text-sm">
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
      <div className="border-t pt-3 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <SegmentedControl
            size="sm"
            aria-label="Message channel"
            value={channel}
            onValueChange={setChannel}
            options={[
              { value: "text", label: "Text" },
              { value: "email", label: "Email" },
            ]}
          />
          <label className="text-sm flex-1">
            Reply to
            <select
              aria-label="Reply conversation"
              className="ml-2 rounded border bg-background p-1 max-w-full"
              value={selected}
              onChange={(e) => {
                setDestination(e.target.value);
                setDraft("");
                setPurpose(undefined);
              }}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.kind}
                </option>
              ))}
              {conversations
                .filter((c) => c.is_group_chat)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.group_chat_name || "Existing group"}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["registration_link", "Registration link"],
              ["ucat_link", "UCAT link"],
              ["followup", "Follow up"],
            ] as const
          ).map(([key, label]) => (
            <Button
              size="sm"
              variant="outline"
              key={key}
              onClick={() => void prepare(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {channel === "email" ? (
          <div className="space-y-2">
            <label className="text-sm">
              Email recipient
              <select
                aria-label="Email recipient"
                value={
                  emailTo ||
                  invite?.parents.find((p) => p.email)?.email ||
                  contact?.email ||
                  ""
                }
                onChange={(e) => setEmailTo(e.target.value)}
                className="bg-background border p-1 ml-2"
              >
                {[
                  ...new Set(
                    [
                      journey.enquiry_email,
                      contact?.email,
                      ...(invite?.parents.map((p) => p.email) ?? []),
                    ].filter((s): s is string => Boolean(s)),
                  ),
                ].map((address) => (
                  <option key={address}>{address}</option>
                ))}
              </select>
            </label>
            <Textarea
              aria-label="Email draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button variant="outline" asChild>
              <a
                href={`mailto:${encodeURIComponent(emailTo || invite?.parents.find((p) => p.email)?.email || contact?.email || "")}?subject=${encodeURIComponent(`Altitutor · ${journey.label}`)}&body=${encodeURIComponent(draft)}`}
              >
                Open email draft
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Send from admin@altitutor.com. The sent email appears after
              mailbox synchronization.
            </p>
          </div>
        ) : selected ? (
          <Composer
            key={selected}
            contactId={contact?.id ?? null}
            conversationId={group?.id}
            groupChatId={group?.group_chat_id}
            draft={draft}
            onDraftChange={setDraft}
            onDraftClear={() => setDraft("")}
            onboarding={
              purpose ? { journeyId: journey.id, purpose } : undefined
            }
            onQueued={() => {
              setPurpose(undefined);
              void messages.refetch();
              onRefresh();
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Link a student or enquiry contact with a phone number to send a
            text.
          </p>
        )}
      </div>
    </div>
  );
});
