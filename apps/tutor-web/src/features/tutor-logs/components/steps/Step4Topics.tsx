'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Plus, Search, ChevronRight, ChevronDown } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { topicsApi } from '@/features/topics/api/topics';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { subjectsApi } from '@/features/subjects/api/subjects';
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
  const [subjectTopics, setSubjectTopics] = useState<Tables<'topics'>[]>([]);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Tables<'subjects'>>>(new Map());
  const [additionalTopicIds, setAdditionalTopicIds] = useState<string[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get session to find subject from vtutor_sessions view
        const sessionData = await sessionsApi.getSession(sessionId);

        if (!sessionData) {
          setIsLoading(false);
          return;
        }

        const subjectId = sessionData.subject_id;

        // Get topics for this subject using vtutor_topics view
        if (subjectId) {
          const topicsData = await topicsApi.getTopicsBySubject(subjectId);
          // Filter out topics with null IDs (shouldn't happen, but type safety)
          setSubjectTopics((topicsData || []).filter((t): t is Tables<'topics'> => t.id !== null && t.name !== null && t.index !== null && t.subject_id !== null));
        }

        // Get all topics for search using vtutor_topics view
        const allTopicsData = await topicsApi.getAllTopics();
        // Filter out topics with null IDs (shouldn't happen, but type safety)
        const validTopics = (allTopicsData || []).filter((t): t is Tables<'topics'> => t.id !== null && t.name !== null && t.index !== null && t.subject_id !== null);
        setAllTopics(validTopics);

        // Fetch subjects for all topics
        if (validTopics.length > 0) {
          const subjectIds = [...new Set(validTopics.map((t) => t.subject_id).filter((id): id is string => id !== null))];
          if (subjectIds.length > 0) {
            const allSubjects = await subjectsApi.getAllSubjects();
            const subjects = new Map<string, Tables<'subjects'>>();
            allSubjects.forEach((s) => {
              if (s.id && subjectIds.includes(s.id)) {
                subjects.set(s.id, s as Tables<'subjects'>);
              }
            });
            setSubjectsMap(subjects);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching topics:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

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
    setSearchTerm('');
    setShowSearch(false);
  };

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

      {!showSearch && (
        <Button variant="outline" onClick={() => setShowSearch(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic from Another Subject
        </Button>
      )}

      {showSearch && (
        <div className="space-y-2 border rounded-md p-4 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {allTopics
              .filter((topic) => {
                if (isTopicSelected(topic.id)) return false;
                if (searchTerm === '') return true;
                
                const searchLower = searchTerm.toLowerCase();
                const topicName = topic.name.toLowerCase();
                const topicCode = (topic.code || '').toLowerCase();
                const subject = topic.subject_id ? subjectsMap.get(topic.subject_id) : null;
                const subjectName = subject ? formatSubjectShortName(subject).toLowerCase() : '';
                
                return (
                  topicName.includes(searchLower) ||
                  topicCode.includes(searchLower) ||
                  subjectName.includes(searchLower)
                );
              })
              .map((topic) => {
                const subject = topic.subject_id ? subjectsMap.get(topic.subject_id) : null;
                const topicCode = topic.code || '';
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';
                
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleAddTopic(topic.id)}
                    className="w-full text-left p-2 hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                  >
                    {subject && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs px-2 py-0.5 shrink-0",
                          defaultClass || textColorClass
                        )}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {formatSubjectShortName(subject)}
                      </Badge>
                    )}
                    <span className="text-sm font-mono text-muted-foreground shrink-0">{topicCode}</span>
                    <span className="flex-1">{topic.name}</span>
                  </button>
                );
              })}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowSearch(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}


