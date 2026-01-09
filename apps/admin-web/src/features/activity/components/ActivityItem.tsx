import type { ActivityEventDisplay } from '../types';
import { ActivityIcon } from './ActivityIcon';
import { cn } from '@/shared/utils';

interface ActivityItemProps {
  activity: ActivityEventDisplay;
  showConnector?: boolean;
  className?: string;
}

export function ActivityItem({ activity, showConnector = true, className }: ActivityItemProps) {
  return (
    <div className={cn('flex gap-3 relative', className)}>
      {/* Icon with connector line */}
      <div className="flex flex-col items-center">
        <ActivityIcon icon={activity.icon} color={activity.iconColor} />
        {showConnector && (
          <div className="w-0.5 h-full bg-border mt-2 min-h-[24px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="text-sm text-foreground">
          <span className="font-medium">{activity.performedBy.name}</span>
          {' '}
          <span className="text-muted-foreground">{activity.message.replace(activity.performedBy.name, '').trim()}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {activity.timestamp}
        </div>
      </div>
    </div>
  );
}

