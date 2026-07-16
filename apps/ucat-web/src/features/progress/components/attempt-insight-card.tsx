import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Sparkles } from "lucide-react";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { AttemptInsight } from "../lib/attempt-insights";

type AttemptInsightCardProps = {
  label: "Overall insight" | "Question insight";
  insight: AttemptInsight;
  className?: string;
  children?: ReactNode;
};

export function AttemptInsightCard({
  label,
  insight,
  className,
  children,
}: AttemptInsightCardProps) {
  return (
    <Card
      className={cn(
        UCAT_CARD_CHROME,
        "overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card",
        insight.tone === "positive" && "border-emerald-500/20",
        insight.tone === "coaching" && "border-amber-500/20",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          {label}
        </div>
        <CardTitle className="pt-1 text-lg font-semibold tracking-tight">
          {insight.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {insight.body}
        </p>
        {children ? (
          <div className="mt-5 border-t border-border/60 pt-4">{children}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
