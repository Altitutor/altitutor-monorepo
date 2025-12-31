'use client';

import { Badge } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { deriveTopicCode } from '@/features/topics/utils/codes';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';

interface TopicCardProps {
  topic: Tables<'topics'>;
  allTopics: Tables<'topics'>[];
  subject?: Tables<'subjects'>;
  parentTopic?: Tables<'topics'>;
}

export function TopicCard({ topic, allTopics, subject, parentTopic }: TopicCardProps) {
  const topicCode = deriveTopicCode(topic, allTopics);
  const { style, textColorClass } = subject ? getSubjectColorStyle(subject) : { style: {}, textColorClass: '' };
  const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-muted-foreground">{topicCode}</span>
            <span className="font-semibold text-sm">{topic.name}</span>
          </div>
          {subject && (
            <Badge
              variant="secondary"
              className={defaultClass || `text-xs px-2 py-0.5 ${textColorClass}`}
              style={style.backgroundColor ? style : undefined}
            >
              {formatSubjectDisplay(subject)}
            </Badge>
          )}
          {parentTopic && (
            <div className="text-xs text-muted-foreground mt-1">
              Parent: {parentTopic.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

