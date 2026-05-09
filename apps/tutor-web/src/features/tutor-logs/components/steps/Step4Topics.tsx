'use client';

import { useMemo, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge, Button, Checkbox, SearchableSelect } from '@altitutor/ui';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useTutorLogStep4Data } from '../../hooks/useTutorLogStep4Data';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils/index';
import { cn } from '@/shared/utils/index';

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
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const crossSubjectTopicOptions = useMemo(
    () => allTopics.filter((topic) => !topics.some((t) => t.topicId === topic.id)),
    [allTopics, topics]
  );

  const handleToggleTopic = (topicId: string, checked: boolean) => {
    if (checked) {
      // Add topic and all children
      const topicAndChildren = getTopicAndDescendants(topicId);
      const newTopics = [...topics];
      topicAndChildren.forEach((id) => {
        if (!newTopics.find((t) => t.topicId === id)) {
          newTopics.push({ topicId: id, studentIds: [] });
        }
      });
      onUpdate(newTopics);
    } else {
      // Remove topic and all children
      const topicAndChildren = getTopicAndDescendants(topicId);
      onUpdate(topics.filter((t) => !topicAndChildren.includes(t.topicId)));
    }
  };

  const getTopicAndDescendants = (topicId: string): string[] => {
    const result = [topicId];
    const children = subjectTopics.filter((t) => t.parent_id === topicId);
    children.forEach((child) => {
      result.push(...getTopicAndDescendants(child.id));
    });
    return result;
  };

  const isTopicSelected = (topicId: string) => {
    return topics.some((t) => t.topicId === topicId);
  };

  const toggleExpanded = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const renderTopicTree = (parentId: string | null, depth: number = 0) => {
    const childTopics = subjectTopics.filter((t) => t.parent_id === parentId);

    return childTopics.map((topic) => {
      const hasChildren = subjectTopics.some((t) => t.parent_id === topic.id);
      const isExpanded = expandedTopics.has(topic.id);
      const code = topic.code || '';

      return (
        <div key={topic.id}>
          <div
            className="flex items-center gap-2 py-2 hover:bg-accent/50 rounded"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleExpanded(topic.id)}
                className="p-1 hover:bg-accent rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            <Checkbox
              checked={isTopicSelected(topic.id)}
              onCheckedChange={(checked) => handleToggleTopic(topic.id, checked === true)}
            />
            <span className="text-sm font-mono text-muted-foreground">{code}</span>
            <span>{topic.name}</span>
          </div>
          {isExpanded && hasChildren && renderTopicTree(topic.id, depth + 1)}
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

  const addTopicFromOtherSubjectTrigger = (
    <Button variant="outline" className="w-full sm:w-auto">
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
        Select topics covered in this session. Selecting a parent automatically selects all children.
      </p>

      {subjectTopics.length > 0 && (
        <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto">
          {renderTopicTree(null)}
        </div>
      )}

      {additionalTopicIds.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">Additional Topics</div>
          <div className="space-y-1">
            {additionalTopicIds.map((topicId) => {
              const topic = allTopics.find((t) => t.id === topicId);
              if (!topic) return null;
              return (
                <div key={topicId} className="p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-md text-sm">
                  {topic.name}
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


