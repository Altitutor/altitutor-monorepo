"use client";
import { Button } from "@altitutor/ui";
import { Mail } from "lucide-react";
import type { EmailMessage } from "../types";
import { useOpenEmailThread } from "../hooks/useOpenEmailThread";
export function EmailCorrespondenceCard({
  message,
}: {
  message: EmailMessage;
}) {
  const open = useOpenEmailThread();
  const at = message.sentAt ?? message.receivedAt;
  return (
    <article className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Email · {message.sender} → {message.to.join(", ")}
        {at ? ` · ${new Date(at).toLocaleString("en-AU")}` : ""}
      </p>
      <Button
        variant="link"
        className="h-auto max-w-full justify-start p-0 text-left"
        onClick={() => open(message.threadId, message.subject)}
      >
        <Mail className="mr-2 h-3 w-3 shrink-0" />
        <span className="truncate">
          {message.subject || "Email conversation"}
        </span>
      </Button>
      <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {message.bodyText}
      </p>
    </article>
  );
}
