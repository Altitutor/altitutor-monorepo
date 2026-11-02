"use client";
import { Badge, Button } from "@altitutor/ui";
import { Clock } from "lucide-react";
import type { EmailMessage } from "../types";
import { EmailParticipant } from "./EmailParticipant";
import { EmailBody } from "./EmailMessageBody";
import { EmailAttachments } from "./EmailAttachments";

export function EmailPendingMessage({
  message,
  state,
  scheduledAt,
  mailboxAddress,
  onCancel,
  busy,
}: {
  message: EmailMessage;
  state: string;
  scheduledAt: string | null;
  mailboxAddress: string;
  onCancel: () => void;
  busy: boolean;
}) {
  const scheduled = state === "scheduled" || state === "paused";
  const time = scheduledAt
    ? new Date(scheduledAt).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : undefined;
  return (
    <section
      aria-label={scheduled ? "Scheduled email" : "Pending email"}
      className="m-4 space-y-4 rounded-2xl bg-muted/35 p-4 ring-1 ring-inset ring-border/40"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Badge variant="secondary" className="rounded-full">
          <Clock className="mr-1 h-3 w-3" />
          {scheduled
            ? state === "paused"
              ? "Schedule paused"
              : "Scheduled"
            : state === "submitted"
              ? "Submitted"
              : "Pending delivery"}
        </Badge>
        {scheduled && time && (
          <time dateTime={scheduledAt!} className="text-muted-foreground">
            Scheduled for {time}
          </time>
        )}
      </header>
      {state === "paused" && (
        <p className="text-xs text-muted-foreground">
          Delivery paused after an Outlook draft change. Cancel the schedule to
          review and edit.
        </p>
      )}
      {state === "uncertain" && (
        <p className="text-xs text-muted-foreground">
          Send outcome is unresolved. Do not submit another copy.
        </p>
      )}
      <div className="space-y-2 border-b pb-3 text-sm">
        <h2 className="font-medium">{message.subject || "(no subject)"}</h2>
        {[
          ["From", [message.sender]],
          ["To", message.to],
          ["Cc", message.cc],
          ["Bcc", message.bcc],
        ].map(
          ([label, addresses]) =>
            Array.isArray(addresses) &&
            addresses.length > 0 && (
              <div
                key={String(label)}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2"
              >
                <span className="pt-1 text-xs text-muted-foreground">
                  {label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {addresses.map((email) => (
                    <EmailParticipant
                      key={email}
                      email={email}
                      label={email}
                      threadId={message.threadId}
                      mailboxAddress={mailboxAddress}
                    />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
      <EmailBody text={message.bodyText} html={message.bodyHtml} />
      {message.hasAttachments && <EmailAttachments id={message.id} />}
      {scheduled && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel schedule
        </Button>
      )}
    </section>
  );
}
