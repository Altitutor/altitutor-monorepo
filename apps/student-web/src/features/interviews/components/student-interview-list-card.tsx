import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ClickableCardIcon, ClickableCardRevealChevron, clickableCardFocusRingCn, clickableCardHoverCn } from "@altitutor/ui";
import { studentCardCn } from "@/shared/lib/student-visual";

export function StudentInterviewListCard({ href, icon, title, description }: {
  href: string; icon: LucideIcon; title: string; description: string;
}) {
  return (
    <Link href={href} className={studentCardCn(
      "group flex w-full items-center gap-4 p-5",
      clickableCardHoverCn, clickableCardFocusRingCn, "hover:bg-muted dark:hover:bg-muted",
    )}>
      <ClickableCardIcon icon={icon} size="sm" />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ClickableCardRevealChevron size="sm" />
    </Link>
  );
}
