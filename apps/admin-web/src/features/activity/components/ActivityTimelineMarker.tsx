import type { ActivityEventDisplay } from '../types';
import { ActivityIcon } from './ActivityIcon';
import { ActivityPerformerAvatar } from './ActivityPerformerAvatar';
import { isHumanPerformer } from '../lib/performerDisplay';

interface ActivityTimelineMarkerProps {
  activity: ActivityEventDisplay;
}

export function ActivityTimelineMarker({ activity }: ActivityTimelineMarkerProps) {
  const showPerformerAvatar =
    activity.eventType === 'CREATED' && isHumanPerformer(activity.performedBy.name);

  if (showPerformerAvatar) {
    return <ActivityPerformerAvatar name={activity.performedBy.name} />;
  }

  return <ActivityIcon icon={activity.icon} color={activity.iconColor} />;
}
