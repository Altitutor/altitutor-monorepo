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
import { ComposeModeControl, type ComposeMode } from "@/features/activity/components/ComposeModeControl";
import { useStudentActivity } from "@/features/activity/hooks/useActivityEvents";
import { useEntityActivityNoteComposer, activityKeys } from "@/features/activity/hooks";
import {
  communicationFilterOptions,
  contactSourceId,
  groupConversationSourceId,
  sourcesAfterRecipientChange,
  EMAIL_SOURCE_ID,
  ACTIVITY_SOURCE_ID,
} from "@/features/activity/lib/entityCommunication";
import { NoteComposerWithTemplate } from "@/shared/components/NoteComposerWithTemplate";
import { isTiptapContentEmpty } from "@/shared/utils/plainTextToTiptapJson";
import { isMessageComposerSendShortcut } from "@/features/messages/utils/composerShortcut";
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
  const [mode, setMode] = useState<ComposeMode>("message");
  const [sourceOverride, setSourceOverride] = useState<string[] | null>(null);
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
  const noteComposer = useEntityActivityNoteComposer({
    targetType: "student",
    targetId: journey.student_id ?? "",
    activityQueryKey: activityKeys.student(journey.student_id ?? ""),
  });
  const inviteQuery = useStudentInviteData(
    journey.student_id ?? "",
    "registration",
    Boolean(journey.student_id),
  );
  const invite = inviteQuery.data;
  const { data: staff } = useCurrentStaff();
  const contacts = useMemo(() => context?.contacts ?? [], [context?.contacts]);
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
  const filterOptions = communicationFilterOptions({
    contacts: contacts.map((person) => ({
      id: person.id,
      kind: person.kind === "parent" ? "parent" as const : "student" as const,
      label: person.label,
      isCurrent: true,
      detail: person.phone_e164 || person.kind,
    })),
    groups: conversations
      .filter((conversation) => conversation.is_group_chat)
      .map((conversation) => ({
        id: conversation.id,
        label: conversation.group_chat_name || "Group texts",
      })),
    includeEmail: true,
  });
  const sources = sourceOverride ?? filterOptions.map((option) => option.id);
  function sourceFor(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return "unknown";
    if (conversation.is_group_chat) return groupConversationSourceId(conversation.id);
    return conversation.contact_id ? contactSourceId(conversation.contact_id) : "unknown";
  }
  function recipientSource(id: string) {
    return conversations.some((conversation) => conversation.id === id && conversation.is_group_chat)
      ? groupConversationSourceId(id)
      : contactSourceId(id);
  }
  const visible = (messages.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (m) => sources.includes(sourceFor(m.conversation_id)),
  );
  const entries: ThreadFeedEntry[] = sources.includes(ACTIVITY_SOURCE_ID)
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
  if (sources.includes(EMAIL_SOURCE_ID))
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
    setMode("message");
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
                      setSourceOverride((current) =>
                        sourcesAfterRecipientChange(
                          current ?? sources,
                          recipientSource(recipient.id),
                        ),
                      );
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
            {filterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={sources.includes(option.id)}
                onCheckedChange={(checked) =>
                  setSourceOverride((current) => {
                    const base = current ?? sources;
                    return checked
                      ? base.includes(option.id)
                        ? base
                        : [...base, option.id]
                      : base.filter((item) => item !== option.id);
                  })
                }
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {sources.includes(EMAIL_SOURCE_ID) && !mailbox.data?.length && (
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
            const conversation = conversations.find((item) => item.id === id);
            if (!conversation) return undefined;
            if (conversation.is_group_chat) return conversation.group_chat_name ?? "Group";
            const person = contacts.find((item) => item.id === conversation.contact_id);
            if (!person) return undefined;
            return person.label;
          },
        }}
      />
      {mode === "note" ? (
        <div
          className="flex-shrink-0 border-t bg-background p-2"
          onKeyDownCapture={(event) => {
            if (!journey.student_id || !isMessageComposerSendShortcut(event) || isTiptapContentEmpty(noteComposer.content)) return;
            event.preventDefault();
            void noteComposer.onSubmit();
          }}
        >
          {journey.student_id ? (
            <NoteComposerWithTemplate
              content={noteComposer.content}
              onChange={noteComposer.onChange}
              onSubmit={noteComposer.onSubmit}
              isSubmitting={noteComposer.isSubmitting}
              canPost={noteComposer.canPost}
              modeControl={<ComposeModeControl value={mode} onValueChange={setMode} />}
            />
          ) : (
            <div className="flex items-center justify-between gap-2 p-2">
              <p className="text-sm text-muted-foreground">Link a student before adding a note.</p>
              <ComposeModeControl value={mode} onValueChange={setMode} />
            </div>
          )}
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
          toolbarBeforeTemplate={<ComposeModeControl value={mode} onValueChange={setMode} />}
          onboarding={purpose ? { journeyId: journey.id, purpose } : undefined}
          onQueued={() => {
            setPurpose(undefined);
            void messages.refetch();
            onRefresh();
          }}
        />
      ) : (
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t p-4">
          <p className="text-sm text-muted-foreground">
            Link a student or enquiry contact with a phone number to send a text.
          </p>
          <ComposeModeControl value={mode} onValueChange={setMode} />
        </div>
      )}
    </div>
  );
});
