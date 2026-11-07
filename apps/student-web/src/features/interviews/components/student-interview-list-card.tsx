import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ClickableCardIcon, ClickableCardRevealChevron, clickableCardFocusRingCn, clickableCardHoverCn } from "@altitutor/ui";
import { studentCardCn } from "@/shared/lib/student-visual";

type CardAction = { href: string; onClick?: never } | { href?: never; onClick: () => void };

export function StudentInterviewListCard({ href, onClick, icon, title, description }: {
  icon: LucideIcon; title: string; description: string;
} & CardAction) {
  const className = studentCardCn(
    "group flex w-full items-center gap-4 p-5 text-left",
    clickableCardHoverCn, clickableCardFocusRingCn, "hover:bg-muted dark:hover:bg-muted",
  );
  const content = (
    <>
      <ClickableCardIcon icon={icon} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ClickableCardRevealChevron size="sm" />
    </>
  );
  return href === undefined
    ? <button type="button" onClick={onClick} className={className}>{content}</button>
    : <Link href={href} className={className}>{content}</Link>;
}
