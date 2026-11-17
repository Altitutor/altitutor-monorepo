"use client";

import { useState } from "react";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";
import { UserRoundPlus } from "lucide-react";
import { getEnquirySender, type EnquirySource } from "../api/enquiries";

const NewJourney = dynamic(() => import("./NewJourney").then((module) => module.NewJourney));

export function EnquiryAction({ source, active }: { source: EnquirySource; active: boolean }) {
  const [open, setOpen] = useState(false);
  const sender = useQuery({
    queryKey: ["onboarding", "enquiry-source", source.kind, source.id],
    queryFn: () => getEnquirySender(source),
    enabled: active || open,
    staleTime: 30_000,
  });
  useRegisterRecordActions(source.kind, source.id, "Enquiry", [
    { id: "new-enquiry", title: "New enquiry", icon: UserRoundPlus, action: () => setOpen(true) },
  ], { active: Boolean(sender.data), runOnly: true });
  if (!sender.data) return null;
  return (
    <>
      <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
            aria-label="New enquiry" onClick={() => setOpen(true)}>
            <UserRoundPlus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New enquiry</TooltipContent>
      </Tooltip>
      </TooltipProvider>
      {open && <NewJourney source={source} sender={sender.data} onClose={() => setOpen(false)} />}
    </>
  );
}
