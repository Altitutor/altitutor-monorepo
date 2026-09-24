'use client';

import { useMemo, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge, Button, Checkbox, SearchableSelect } from '@altitutor/ui';
import { Plus, X } from 'lucide-react';
import { useTutorLogStep4Data } from '../../hooks/useTutorLogStep4Data';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils/index';
import { cn } from '@/shared/utils/index';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';

type TopicItem = {
  topicId: string;
  studentIds: string[];
};

type Step4TopicsProps = {
  sessionId: string;
  topics: TopicItem[];
  onUpdate: (topics: TopicItem[]) => void;
};

export function Step4Topics({ sessionId, topics, onUpdate }: Step4TopicsProps) {
  const {
    subjectTopics,
    allTopics,
    subjectsMap,
    isLoading,
  } = useTutorLogStep4Data(sessionId);

  const [additionalTopicIds, setAdditionalTopicIds] = useState<string[]>([]);

  const crossSubjectTopicOptions = useMemo(
    () => allTopics.filter((topic) => !topics.some((t) => t.topicId === topic.id)),
    [allTopics, topics]
  );

  const getTopicAndDescendants = (topicId: string): string[] => {
    const result = [topicId];
    const children = subjectTopics.filter((t) => t.parent_id === topicId);
    children.forEach((child) => {
      result.push(...getTopicAndDescendants(child.id));
    });
    return result;
  };

  const handleToggleTopic = (topicId: string, checked: boolean) => {
    if (checked) {
      const topicAndChildren = getTopicAndDescendants(topicId);
      const newTopics = [...topics];
      topicAndChildren.forEach((id) => {
        if (!newTopics.find((t) => t.topicId === id)) {
          newTopics.push({ topicId: id, studentIds: [] });
        }
      });
      onUpdate(newTopics);
    } else {
      const topicAndChildren = getTopicAndDescendants(topicId);
      onUpdate(topics.filter((t) => !topicAndChildren.includes(t.topicId)));
    }
  };

  const isTopicSelected = (topicId: string) => {
    return topics.some((t) => t.topicId === topicId);
  };

  const renderTopicTree = (parentId: string | null, depth: number = 0) => {
    const childTopics = subjectTopics.filter((t) => t.parent_id === parentId);

    return childTopics.map((topic) => {
      const hasChildren = subjectTopics.some((t) => t.parent_id === topic.id);
      const selected = isTopicSelected(topic.id);
      const code = topic.code || '';

      return (
        <div key={topic.id}>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => handleToggleTopic(topic.id, !selected)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleToggleTopic(topic.id, !selected);
              }
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg py-2 hover:bg-muted/40"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            <Checkbox checked={selected} tabIndex={-1} className="pointer-events-none" />
            <span className="text-sm font-mono text-muted-foreground">{code}</span>
            <span>{topic.name}</span>
          </div>
          {hasChildren ? renderTopicTree(topic.id, depth + 1) : null}
        </div>
      );
    });
  };

  const handleAddTopic = (topicId: string) => {
    if (!additionalTopicIds.includes(topicId)) {
      setAdditionalTopicIds([...additionalTopicIds, topicId]);
      if (!topics.find((t) => t.topicId === topicId)) {
        onUpdate([...topics, { topicId, studentIds: [] }]);
      }
    }
  };

  const handleRemoveTopic = (topicId: string) => {
    setAdditionalTopicIds(additionalTopicIds.filter((id) => id !== topicId));
    onUpdate(topics.filter((t) => t.topicId !== topicId));
  };

  const addTopicFromOtherSubjectTrigger = (
    <Button variant="outline" className={cn(tutorBtnOutline, 'w-full sm:w-auto')}>
      <Plus className="h-4 w-4 mr-2" />
      Add Topic from Another Subject
    </Button>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select all topic(s) taught during this session.
      </p>

      {subjectTopics.length > 0 && (
        <div className={tutorCardCn('max-h-[400px] overflow-y-auto p-4')}>
          {renderTopicTree(null)}
        </div>
      )}

      {additionalTopicIds.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium">Additional Topics</div>
          <div className="space-y-2">
            {additionalTopicIds.map((topicId) => {
              const topic = allTopics.find((t) => t.id === topicId);
              if (!topic) return null;
              const subject = topic.subject_id ? subjectsMap.get(topic.subject_id) : null;
              const topicCode = topic.code || '';
              const { style, textColorClass } = getSubjectColorStyle(subject);
              const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';

              return (
                <div
                  key={topicId}
                  className={tutorCardCn('flex items-center gap-3 bg-muted/30 p-3')}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {subject && (
                      <Badge
                        variant="secondary"
                        className={cn('shrink-0 px-2 py-0.5 text-xs', defaultClass || textColorClass)}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectShortName(subject)}
                      </Badge>
                    )}
                    {topicCode ? (
                      <span className="shrink-0 font-mono text-sm text-muted-foreground">{topicCode}</span>
                    ) : null}
                    <span className="min-w-0 truncate text-sm">{topic.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTopic(topicId)}
                    aria-label={`Remove ${topic.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <SearchableSelect<Tables<'topics'>>
          items={crossSubjectTopicOptions}
          value={null}
          onValueChange={(topic) => {
            if (topic) handleAddTopic(topic.id);
          }}
          getItemId={(t) => t.id}
          getItemLabel={(t) => (t.code ? `${t.code} ${t.name}` : t.name)}
          getItemValue={(t) => {
            const subject = t.subject_id ? subjectsMap.get(t.subject_id) : null;
            const subjectName = subject ? formatSubjectShortName(subject) : '';
            return `${t.name} ${t.code ?? ''} ${subjectName}`.toLowerCase();
          }}
          searchPlaceholder="Search topics..."
          emptyMessage="No matching topics, or all topics are already selected"
          trigger={addTopicFromOtherSubjectTrigger}
          align="start"
          contentWidth="min(400px, 92vw)"
          renderItem={(topic) => {
            const subject = topic.subject_id ? subjectsMap.get(topic.subject_id) : null;
            const topicCode = topic.code || '';
            const { style, textColorClass } = getSubjectColorStyle(subject);
            const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';

            return (
              <div className="flex items-center gap-2 w-full min-w-0">
                {subject && (
                  <Badge
                    variant="secondary"
                    className={cn('text-xs px-2 py-0.5 shrink-0', defaultClass || textColorClass)}
                    style={style.backgroundColor ? style : undefined}
                  >
                    {formatSubjectShortName(subject)}
                  </Badge>
                )}
                <span className="text-sm font-mono text-muted-foreground shrink-0">{topicCode}</span>
                <span className="flex-1 min-w-0 truncate">{topic.name}</span>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
