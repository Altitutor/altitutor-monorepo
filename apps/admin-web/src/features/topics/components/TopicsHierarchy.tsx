'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { ChevronRight, ChevronDown, Plus, Download, FileIcon } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useTopicFilesByTopic } from '../hooks';
import { deriveTopicCode, deriveTopicFileCode, buildTopicTree, type TopicTree } from '../utils/codes';
import { FilePreview } from './FilePreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';

export interface TopicsHierarchyProps {
  subjectId: string | null;
  searchQuery?: string;
  showAddTopic?: boolean;
  showAddResource?: boolean;
  onTopicClick?: (topicId: string) => void;
  onAddTopicClick?: (parentId?: string) => void;
  onAddResourceClick?: (topicId: string) => void;
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
  searchQuery,
}: TopicNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  
  const { data: topicFiles = [] } = useTopicFilesByTopic(isExpanded ? topic.id : null);

  const hasChildren = topic.children && topic.children.length > 0;
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

  const handlePreview = async (fileId: string, storagePath: string) => {
    // Create signed URL for preview
    setPreviewFileId(fileId);
    // Note: In production, you'd get a signed URL from your API
    setPreviewFileUrl(storagePath);
  };

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
            <div className="space-y-1 mb-2">
              {topicFiles.map((tf) => {
                const fileCode = deriveTopicFileCode(tf, topic.code, tf.type);
                return (
                  <div
                    key={tf.id}
                    className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded text-sm"
                  >
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{fileCode}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {tf.file?.filename || 'Unknown file'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => tf.file && handlePreview(tf.file.id, tf.file.storage_path)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
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

      {/* File Preview Modal */}
      {previewFileId && previewFileUrl && (
        <Dialog open={!!previewFileId} onOpenChange={() => setPreviewFileId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>File Preview</DialogTitle>
            </DialogHeader>
            <FilePreview
              fileUrl={previewFileUrl}
              fileName={topicFiles.find(tf => tf.file?.id === previewFileId)?.file?.filename || 'file'}
              mimeType={topicFiles.find(tf => tf.file?.id === previewFileId)?.file?.mimetype || 'application/octet-stream'}
            />
          </DialogContent>
        </Dialog>
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

