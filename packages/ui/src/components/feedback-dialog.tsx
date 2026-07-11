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
import { PhoneInput } from "./phone-input";
import { validateOptionalPhoneE164 } from "../lib/phone";
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
  collectContactDetails?: boolean;
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
  collectContactDetails = false,
}: FeedbackDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSubject(initialSubject);
      setMessage(initialMessage);
      setContactEmail(user?.email?.trim() ?? "");
      setContactPhone("");
      setPhoneError(undefined);
      setIsSubmitting(false);
    } else {
      setSubject("");
      setMessage("");
      setContactEmail("");
      setContactPhone("");
      setPhoneError(undefined);
      setIsSubmitting(false);
    }
  }, [initialMessage, initialSubject, open, user?.email]);

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

    const trimmedEmail = contactEmail.trim().toLowerCase();
    if (kind === "contact" && collectContactDetails && !trimmedEmail) {
      toast({
        title: "Email required",
        description: "Add an email address so we can reply to you.",
        variant: "destructive",
      });
      return;
    }

    const phoneValidation = validateOptionalPhoneE164(contactPhone);
    if (kind === "contact" && collectContactDetails && phoneValidation.error) {
      setPhoneError(phoneValidation.error);
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
          contact:
            kind === "contact" && collectContactDetails
              ? { email: trimmedEmail, phone: phoneValidation.phone }
              : undefined,
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

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
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

          {kind === "contact" && collectContactDetails ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="feedback-email">Email</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-phone">Phone (optional)</Label>
                <PhoneInput
                  value={contactPhone}
                  onChange={(value) => {
                    setContactPhone(value);
                    setPhoneError(undefined);
                  }}
                  placeholder="Phone number"
                  disabled={isSubmitting}
                  error={phoneError}
                  className="[&_.PhoneInputInput]:h-10"
                />
              </div>
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
