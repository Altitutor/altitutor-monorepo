"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { Button } from "./button";

export interface ActiveInterviewLink { id: string; name: string; href: string }

export function InterviewRejoinBanner({ rounds }: { rounds: ActiveInterviewLink[] }) {
  if (!rounds.length) return null;
  return <aside aria-label="Active interviews" aria-live="polite" className="space-y-2 pt-4">
    {rounds.map((round) => <div key={round.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Video className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Interview in progress</p><p className="break-words text-sm text-muted-foreground">{round.name}</p></div>
      </div>
      <Button asChild size="sm"><Link href={round.href}>Rejoin interview</Link></Button>
    </div>)}
  </aside>;
}
