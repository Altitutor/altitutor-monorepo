'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useTopicFilesByTopic } from '../hooks';
import { deriveTopicFileCode, buildTopicTree, type TopicTree } from '../utils/codes';
import { FileCard } from './FileCard';

export interface TopicsHierarchyProps {
  subjectId: string | null;
  searchQuery?: string;
  showAddTopic?: boolean;
  showAddResource?: boolean;
  onTopicClick?: (topicId: string) => void;
  onAddTopicClick?: (parentId?: string) => void;
  onAddResourceClick?: (topicId: string) => void;
  onEditFileClick?: (topicFileId: string, topicId: string, subjectId: string) => void;
  allTopics: Tables<'topics'>[];  // All topics for the subject
}

export interface TopicNodeProps {
  topic: TopicTree;
  allTopics: Tables<'topics'>[];
  level: number;
  showAddTopic?: boolean;
  showAddResource?: boolean;
  onTopicClick?: (topicId: string) => void;
  onAddTopicClick?: (parentId?: string) => void;
  onAddResourceClick?: (topicId: string) => void;
  onEditFileClick?: (topicFileId: string, topicId: string, subjectId: string) => void;
  searchQuery?: string;
}

export function TopicNode({
  topic,
  allTopics,
  level,
  showAddTopic,
  showAddResource,
  onTopicClick,
  onAddTopicClick,
  onAddResourceClick,
  onEditFileClick,
  searchQuery,
}: TopicNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: topicFiles = [] } = useTopicFilesByTopic(isExpanded ? topic.id : null);

  const paddingLeft = level * 24;

  // Filter based on search query
  const matchesSearch = !searchQuery || 
    topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.code.toLowerCase().includes(searchQuery.toLowerCase());

  // Check if any descendant matches search
  const hasMatchingDescendant = (node: TopicTree): boolean => {
    if (!searchQuery) return false;
    
    for (const child of node.children) {
      if (child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          child.code.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      if (hasMatchingDescendant(child)) {
        return true;
      }
    }
    return false;
  };

  const shouldShow = matchesSearch || hasMatchingDescendant(topic);

  if (!shouldShow) {
    return null;
  }

  return (
    <div>
      {/* Topic Row */}
      <div
        className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded group"
        style={{ paddingLeft }}
      >
        {/* Expand/Collapse Button - Always show for resource files access */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-muted rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Topic Code and Name */}
        <button
          onClick={() => onTopicClick?.(topic.id)}
          className="flex-1 text-left hover:underline flex items-center gap-2"
        >
          <span className="font-mono text-sm text-muted-foreground">{topic.code}</span>
          <span className="text-sm">{topic.name}</span>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="ml-6" style={{ paddingLeft }}>
          {/* Topic Files */}
          {topicFiles.length > 0 && (
            <div className="space-y-2 mb-2">
              {topicFiles.map((tf) => {
                const fileCode = deriveTopicFileCode(tf, topic.code, tf.type);
                // Get the full topic record to access subject_id
                const fullTopic = allTopics.find(t => t.id === topic.id);
                return (
                  <FileCard
                    key={tf.id}
                    fileCode={fileCode}
                    fileType={tf.type}
                    filename={tf.file?.filename || 'Unknown file'}
                    storagePath={tf.file?.storage_path || ''}
                    mimeType={tf.file?.mimetype}
                    topicFileId={tf.id}
                    currentTopicId={topic.id}
                    currentSubjectId={fullTopic?.subject_id}
                    onEdit={
                      onEditFileClick && fullTopic
                        ? (topicFileId) => onEditFileClick(topicFileId, topic.id, fullTopic.subject_id)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Add Resource Button */}
          {showAddResource && (
            <Button
              variant="outline"
              size="sm"
              className="mb-2"
              onClick={() => onAddResourceClick?.(topic.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Resource
            </Button>
          )}

          {/* Child Topics */}
          {topic.children.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              allTopics={allTopics}
              level={level + 1}
              showAddTopic={showAddTopic}
              showAddResource={showAddResource}
              onTopicClick={onTopicClick}
              onAddTopicClick={onAddTopicClick}
              onAddResourceClick={onAddResourceClick}
              onEditFileClick={onEditFileClick}
              searchQuery={searchQuery}
            />
          ))}

          {/* Add Child Topic Button */}
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
  showAddResource = false,
  onTopicClick,
  onAddTopicClick,
  onAddResourceClick,
  onEditFileClick,
  allTopics,
}: TopicsHierarchyProps) {
  if (!subjectId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please select a subject</p>
      </div>
    );
  }

  // Filter topics for this subject
  const subjectTopics = allTopics.filter(t => t.subject_id === subjectId);
  
  // Build hierarchical tree
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
          showAddResource={showAddResource}
          onTopicClick={onTopicClick}
          onAddTopicClick={onAddTopicClick}
          onAddResourceClick={onAddResourceClick}
          onEditFileClick={onEditFileClick}
          searchQuery={searchQuery}
        />
      ))}
      
      {/* Add Root Topic Button */}
      {showAddTopic && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => onAddTopicClick?.()}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Root Topic
        </Button>
      )}
    </div>
  );
}

