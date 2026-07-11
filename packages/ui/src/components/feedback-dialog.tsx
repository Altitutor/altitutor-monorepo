"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Input } from "./input";
import { Label } from "./label";
import { useToast } from "./use-toast";

export type FeedbackKind = "contact" | "bug";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: FeedbackKind;
  appName: string;
  user?: {
    name?: string | null;
    email?: string | null;
    id?: string | null;
  };
  initialSubject?: string;
  initialMessage?: string;
  diagnostics?: Record<string, unknown>;
};

const TITLES: Record<FeedbackKind, string> = {
  contact: "Contact us",
  bug: "Report a bug",
};

const DESCRIPTIONS: Record<FeedbackKind, string> = {
  contact: "Send a message to the Altitutor team.",
  bug: "Tell us what went wrong so we can investigate.",
};

export function FeedbackDialog({
  open,
  onOpenChange,
  kind,
  appName,
  user,
  initialSubject = "",
  initialMessage = "",
  diagnostics,
}: FeedbackDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSubject(initialSubject);
      setMessage(initialMessage);
      setIsSubmitting(false);
    } else {
      setSubject("");
      setMessage("");
      setIsSubmitting(false);
    }
  }, [initialMessage, initialSubject, open]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      toast({
        title: "Message required",
        description: "Add a short message before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          appName,
          subject: subject.trim(),
          message: trimmedMessage,
          user,
          diagnostics: {
            path: window.location.pathname,
            href: window.location.href,
            userAgent: window.navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString(),
            ...diagnostics,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send feedback");
      }

      toast({
        title: kind === "bug" ? "Bug report sent" : "Message sent",
        description:
          kind === "bug"
            ? "Thank you. We will address this as soon as we can."
            : "Thank you. We will reach out to you.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not send",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{TITLES[kind]}</DialogTitle>
            <DialogDescription>{DESCRIPTIONS[kind]}</DialogDescription>
          </DialogHeader>

          {kind === "bug" ? (
            <div className="space-y-2">
              <Label htmlFor="feedback-subject">What happened?</Label>
              <Input
                id="feedback-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Brief summary"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="feedback-message">
              {kind === "bug" ? "Details" : "Message"}
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                kind === "bug"
                  ? "What were you trying to do, what happened, and what did you expect?"
                  : "How can we help?"
              }
              className="min-h-32"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
