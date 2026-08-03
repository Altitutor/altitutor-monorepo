import { Badge, getStudentStatusColor } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';

interface InPersonStatusBadgeProps {
  status: Tables<'students'>['status'];
  className?: string;
}

export function InPersonStatusBadge({ status, className }: InPersonStatusBadgeProps) {
  if (!status) return null;
  const badgeStatus = status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';

  return (
    <Badge className={`${getStudentStatusColor(badgeStatus)} ${className ?? ''}`.trim()}>
      In person · {status}
    </Badge>
  );
}
