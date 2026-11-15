"use client";

import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { MediaDeviceTest } from "./media-device-test";
import { releaseWaitingInterviewMicrophone } from "../hooks/use-interview-capture";

/** Release the waiting-room preview while a private local device test is open. */
export function InterviewWaitingMedia({ children, roundId, available }: {
  children: React.ReactNode;
  roundId: string;
  available: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const open = testing && available;
  useEffect(() => {
    if (open) releaseWaitingInterviewMicrophone(roundId);
    if (!available) setTesting(false);
  }, [open, available, roundId]);
  return (
    <div className="min-w-0 space-y-3">
      <Dialog open={open} onOpenChange={setTesting}>
        {available && <div className="flex justify-end">
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <SlidersHorizontal aria-hidden />Test audio & video
            </Button>
          </DialogTrigger>
        </div>}
        {open ? (
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" primaryShortcut={false}>
            <DialogHeader>
              <DialogTitle>Test audio & video</DialogTitle>
              <DialogDescription>Check your camera and listen to a test clip before the interview starts.</DialogDescription>
            </DialogHeader>
            <MediaDeviceTest />
          </DialogContent>
        ) : children}
      </Dialog>
    </div>
  );
}
