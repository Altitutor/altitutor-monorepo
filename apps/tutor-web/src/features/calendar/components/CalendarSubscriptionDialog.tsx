"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@altitutor/ui";
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/shared/utils";
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogHeaderStrip,
} from "@/shared/lib/tutor-visual";

interface CalendarSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function CalendarSubscriptionDialog({
  open,
  onOpenChange,
}: CalendarSubscriptionDialogProps) {
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    if (!open || subscriptionUrl) return;

    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    fetch("/api/calendar", { method: "POST", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          subscriptionUrl?: string;
          error?: string;
        };
        if (!response.ok || !body.subscriptionUrl) {
          throw new Error(
            body.error || "Could not create your calendar subscription.",
          );
        }
        setSubscriptionUrl(body.subscriptionUrl);
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        )
          return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not create your calendar subscription.",
        );
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [loadVersion, open, subscriptionUrl]);

  const copyUrl = async () => {
    if (!subscriptionUrl) return;
    await copyToClipboard(subscriptionUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const copyAndOpen = async (providerUrl: string) => {
    await copyUrl();
    window.open(providerUrl, "_blank", "noopener,noreferrer");
  };

  const webcalUrl = subscriptionUrl.replace(/^https?:\/\//, "webcal://");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
          tutorDialogContentClass,
        )}
      >
        <div className={cn("shrink-0", tutorDialogHeaderStrip)}>
          <DialogHeader className="px-6 py-4">
            <div className="flex items-start gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onOpenChange(false)}
                className={tutorBtnIconOutline}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle>Add Altitutor timetable to calendar</DialogTitle>
                <DialogDescription>
                  Subscribe once. Your calendar provider will periodically pick
                  up new, changed, and cancelled sessions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your private calendar link…
            </div>
          ) : error ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className={tutorBtnOutline}
                onClick={() => {
                  setError("");
                  setSubscriptionUrl("");
                  setLoadVersion((version) => version + 1);
                }}
              >
                Try again
              </Button>
            </div>
          ) : subscriptionUrl ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  asChild
                  className={cn("justify-between", tutorBtnPrimary)}
                >
                  <a href={webcalUrl}>
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Apple Calendar
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className={cn("justify-between", tutorBtnOutline)}
                  onClick={() =>
                    copyAndOpen(
                      "https://calendar.google.com/calendar/u/0/r/settings/addbyurl",
                    )
                  }
                >
                  Google Calendar
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className={cn("justify-between", tutorBtnOutline)}
                  onClick={() =>
                    copyAndOpen(
                      "https://outlook.live.com/calendar/0/addcalendar",
                    )
                  }
                >
                  Outlook
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className={cn("justify-between", tutorBtnOutline)}
                  onClick={copyUrl}
                >
                  Other calendar
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="calendar-subscription-url"
                  className="text-sm font-medium"
                >
                  Private subscription URL
                </label>
                <div className="flex gap-2">
                  <Input
                    id="calendar-subscription-url"
                    value={subscriptionUrl}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className={tutorBtnIconOutline}
                    onClick={copyUrl}
                    aria-label="Copy URL"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Google and Outlook: the URL is copied automatically; paste it
                  into the provider’s subscription URL field. Keep this link
                  private—anyone with it can view your timetable.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
