'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { buildTopicTree, type TopicTree } from '../utils/codes';

export interface TopicsHierarchyProps {
  subjectId: string | null;
  searchQuery?: string;
  showAddTopic?: boolean;
  onTopicClick?: (topicId: string) => void;
  onAddTopicClick?: (parentId?: string) => void;
  allTopics: Tables<'topics'>[];
}

export interface TopicNodeProps {
  topic: TopicTree;
  allTopics: Tables<'topics'>[];
  level: number;
  showAddTopic?: boolean;
  onTopicClick?: (topicId: string) => void;
  onAddTopicClick?: (parentId?: string) => void;
  searchQuery?: string;
}

export function TopicNode({
  topic,
  allTopics,
  level,
  showAddTopic,
  onTopicClick,
  onAddTopicClick,
  searchQuery,
}: TopicNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasChildren = topic.children.length > 0;
  const paddingLeft = level * 24;

  const matchesSearch =
    !searchQuery ||
    topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.code.toLowerCase().includes(searchQuery.toLowerCase());

  const hasMatchingDescendant = (node: TopicTree): boolean => {
    if (!searchQuery) return false;
    for (const child of node.children) {
      if (
        child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        child.code.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return true;
      }
      if (hasMatchingDescendant(child)) return true;
    }
    return false;
  };

  const shouldShow = matchesSearch || hasMatchingDescendant(topic);
  if (!shouldShow) return null;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded group"
        style={{ paddingLeft }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => onTopicClick?.(topic.id)}
          className="flex-1 text-left hover:underline flex items-center gap-2"
        >
          <span className="font-mono text-sm text-muted-foreground">{topic.code}</span>
          <span className="text-sm">{topic.name}</span>
        </button>
      </div>

      {isExpanded && hasChildren && (
        <div className="ml-6" style={{ paddingLeft }}>
          {topic.children.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              allTopics={allTopics}
              level={level + 1}
              showAddTopic={showAddTopic}
              onTopicClick={onTopicClick}
              onAddTopicClick={onAddTopicClick}
              searchQuery={searchQuery}
            />
          ))}

          {showAddTopic && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onAddTopicClick?.(topic.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Child Topic
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TopicsHierarchy({
  subjectId,
  searchQuery,
  showAddTopic = false,
  onTopicClick,
  onAddTopicClick,
  allTopics,
}: TopicsHierarchyProps) {
  if (!subjectId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please select a subject</p>
      </div>
    );
  }

  const subjectTopics = allTopics.filter((t) => t.subject_id === subjectId);
  const topicTree = buildTopicTree(subjectTopics);

  if (topicTree.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="mb-4">No topics found for this subject</p>
        {showAddTopic && (
          <Button onClick={() => onAddTopicClick?.()}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Topic
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {topicTree.map((topic) => (
        <TopicNode
          key={topic.id}
          topic={topic}
          allTopics={subjectTopics}
          level={0}
          showAddTopic={showAddTopic}
          onTopicClick={onTopicClick}
          onAddTopicClick={onAddTopicClick}
          searchQuery={searchQuery}
        />
      ))}

      {showAddTopic && (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => onAddTopicClick?.()}>
          <Plus className="h-3 w-3 mr-1" />
          Add Root Topic
        </Button>
      )}
    </div>
  );
}
