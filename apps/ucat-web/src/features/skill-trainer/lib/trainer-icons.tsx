import {
  Brain,
  Calculator,
  GitBranch,
  ScanEye,
  Search,
  Sigma,
  Target,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  ScanEye,
  GitBranch,
  Brain,
  Calculator,
  Sigma,
  Target,
};

export function TrainerIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = (name && ICON_MAP[name]) || Target;
  return <Icon className={className} aria-hidden />;
}
