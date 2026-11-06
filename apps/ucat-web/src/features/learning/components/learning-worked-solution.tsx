import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export function LearningWorkedSolution({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-xl">
      <div
        inert={locked}
        aria-hidden={locked || undefined}
        className={cn(locked && "select-none blur-xl opacity-45")}
      >
        {children}
      </div>
      {locked ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/55 p-3">
          <div className="flex max-w-full items-start gap-2.5 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">Worked solution</p>
              <p className="text-muted-foreground">Appears here after you submit your answer.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
