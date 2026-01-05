'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Plus, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { TopicCard } from '../TopicCard';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { deriveTopicCode } from '@/features/topics/utils/codes';
import { cn } from '@/shared/utils/index';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  const [additionalTopicIds, setAdditionalTopicIds] = useState<string[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Tables<'subjects'>>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);

      // Get session to find subject
      // Use LEFT join for classes since trial sessions may not have class_id
      const { data: sessionDataResult } = await supabase
        .from('sessions')
        .select('*, class:classes(*, subject:subjects(*)), subject:subjects(*)')
        .eq('id', sessionId)
        .single();

      if (!sessionDataResult) {
        setIsLoading(false);
        return;
      }

      setSessionData(sessionDataResult);
      // Try to get subject from class first, then fall back to direct subject_id
      const subjectId = (sessionDataResult as any).class?.subject?.id || 
                        (sessionDataResult as any).subject?.id ||
                        (sessionDataResult as any).subject_id;

      // Get topics for this subject
      if (subjectId) {
        const { data: topicsData } = await supabase
          .from('topics')
          .select('*')
          .eq('subject_id', subjectId)
          .order('index');

        setSubjectTopics(topicsData || []);
      }

      // Get all topics for search
      const { data: allTopicsData } = await supabase
        .from('topics')
        .select('*')
        .order('name');

      setAllTopics(allTopicsData || []);

      // Get subjects for all topics (for additional topics display)
      if (allTopicsData && allTopicsData.length > 0) {
        const subjectIds = [...new Set(allTopicsData.map((t: any) => t.subject_id).filter(Boolean))];
        if (subjectIds.length > 0) {
          const { data: subjectsData } = await supabase
            .from('subjects')
            .select('*')
            .in('id', subjectIds);
          
          if (subjectsData) {
            const subjects = new Map<string, Tables<'subjects'>>();
            subjectsData.forEach((s: any) => {
              subjects.set(s.id, s);
            });
            setSubjectsMap(subjects);
          }
        }
      }

      setIsLoading(false);
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
      const parentTopic = topic.parent_id ? subjectTopics.find((t) => t.id === topic.parent_id) : undefined;
      // Get subject from class if available, otherwise from direct subject relation
      const subject = sessionData?.class?.subject || sessionData?.subject;

      return (
        <div key={topic.id}>
          <div
            className="flex items-start gap-2 py-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleExpanded(topic.id)}
                className="p-1 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded mt-1"
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
              className="mt-1"
            />
            <div className="flex-1">
              <TopicCard
                topic={topic}
                allTopics={subjectTopics}
                subject={subject}
                parentTopic={parentTopic}
              />
            </div>
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

  const filteredSubjectTopics = subjectTopics.filter((topic) => {
    if (!searchFilter) return true;
    const searchLower = searchFilter.toLowerCase();
    const topicCode = deriveTopicCode(topic, subjectTopics);
    return (
      topic.name.toLowerCase().includes(searchLower) ||
      topicCode.toLowerCase().includes(searchLower)
    );
  });

  const renderFilteredTopicTree = (parentId: string | null, depth: number = 0) => {
    const childTopics = filteredSubjectTopics.filter((t) => t.parent_id === parentId);

    return childTopics.map((topic) => {
      const hasChildren = filteredSubjectTopics.some((t) => t.parent_id === topic.id);
      const isExpanded = expandedTopics.has(topic.id);
      const parentTopic = topic.parent_id ? filteredSubjectTopics.find((t) => t.id === topic.parent_id) : undefined;
      // Get subject from class if available, otherwise from direct subject relation
      const subject = sessionData?.class?.subject || sessionData?.subject;

      return (
        <div key={topic.id}>
          <div
            className="flex items-start gap-2 py-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleExpanded(topic.id)}
                className="p-1 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded mt-1"
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
              className="mt-1"
            />
            <div className="flex-1">
              <TopicCard
                topic={topic}
                allTopics={subjectTopics}
                subject={subject}
                parentTopic={parentTopic}
              />
            </div>
          </div>
          {isExpanded && hasChildren && renderFilteredTopicTree(topic.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select topics covered in this session. Selecting a parent automatically selects all children.
      </p>

      {subjectTopics.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics by name or code..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="space-y-1">
            {renderFilteredTopicTree(null)}
          </div>
        </>
      )}

      {additionalTopicIds.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">Additional Topics</div>
          <div className="space-y-3">
            {additionalTopicIds.map((topicId) => {
              const topic = allTopics.find((t) => t.id === topicId);
              if (!topic) return null;
              // Get subject for this specific topic
              const subject = topic.subject_id ? subjectsMap.get(topic.subject_id) : undefined;
              const parentTopic = topic.parent_id ? allTopics.find((t) => t.id === topic.parent_id) : undefined;
              return (
                <TopicCard
                  key={topicId}
                  topic={topic}
                  allTopics={allTopics}
                  subject={subject}
                  parentTopic={parentTopic}
                />
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
              .filter(
                (topic) =>
                  !isTopicSelected(topic.id) &&
                  (searchTerm === '' || topic.name.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleAddTopic(topic.id)}
                  className="w-full text-left p-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 rounded-md transition-colors"
                >
                  {topic.name}
                </button>
              ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowSearch(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}


