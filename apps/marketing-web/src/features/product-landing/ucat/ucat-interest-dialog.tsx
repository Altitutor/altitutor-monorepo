"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { ArrowRight } from "lucide-react";
import { UcatInterestForm } from "./ucat-interest-form";

type UcatInterestDialogProps = {
  kind: "supported_access" | "online_tutoring_waitlist";
  triggerLabel: string;
  title: string;
  description: string;
  triggerClassName?: string;
};

export function UcatInterestDialog({
  kind,
  triggerLabel,
  title,
  description,
  triggerClassName,
}: UcatInterestDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "inline-flex items-center justify-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-marketing-charcoal"
          }
        >
          {triggerLabel} <ArrowRight className="size-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="border-marketing-charcoal/10 bg-marketing-cream p-6 text-marketing-charcoal sm:max-w-xl sm:rounded-[1.75rem] sm:p-8" mobilePresentation="bottom-sheet">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-2xl font-semibold tracking-tight text-marketing-charcoal">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-marketing-charcoal/58">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-3 rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-marketing-charcoal/10 sm:p-5">
          <UcatInterestForm kind={kind} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
