'use client';

import { useState, useMemo } from 'react';
import {
  TopicsHierarchy,
  AddTopicModal,
  AddResourceFileModal,
  ViewTopicModal,
} from '@/features/topics';
import { Button, Input } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useTopics } from '@/features/topics/hooks';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TopicsPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  
  // Modals state
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [addResourceTopicId, setAddResourceTopicId] = useState<string | undefined>(undefined);
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [isViewTopicModalOpen, setIsViewTopicModalOpen] = useState(false);

  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: allTopics = [], refetch: refetchTopics } = useTopics();

  // Filter subjects based on search query
  const filteredSubjects = useMemo(() => {
    if (!subjectSearchQuery) return subjects;
    
    const query = subjectSearchQuery.toLowerCase();
    return subjects.filter((subject) => {
      const displayText = formatSubjectDisplay(subject).toLowerCase();
      return displayText.includes(query) || subject.name.toLowerCase().includes(query);
    });
  }, [subjects, subjectSearchQuery]);

  const handleAddTopic = (parentId?: string) => {
    setAddTopicParentId(parentId);
    setIsAddTopicModalOpen(true);
  };

  const handleAddResource = (topicId: string) => {
    setAddResourceTopicId(topicId);
    setIsAddResourceModalOpen(true);
  };

  const handleTopicClick = (topicId: string) => {
    setViewTopicId(topicId);
    setIsViewTopicModalOpen(true);
  };

  const handleModalClose = () => {
    // Refetch topics when any modal closes
    refetchTopics();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Topics & Resources</h1>
        </div>
      </div>

      {/* Subject Selector */}
      <div className="mb-4 space-y-2">
        <label className="text-sm font-medium">Select Subject</label>
        <Select value={selectedSubjectId || ''} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <Input
                placeholder="Search subjects..."
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {subjectsLoading ? (
              <SelectItem value="loading" disabled>
                Loading subjects...
              </SelectItem>
            ) : filteredSubjects.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No subjects found
              </div>
            ) : (
              filteredSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {formatSubjectDisplay(subject)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by topic code, name, or resource code..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Topics Hierarchy */}
      <div className="border rounded-lg p-4 bg-card">
        <TopicsHierarchy
          subjectId={selectedSubjectId}
          searchQuery={searchQuery}
          showAddTopic={true}
          showAddResource={true}
          onTopicClick={handleTopicClick}
          onAddTopicClick={handleAddTopic}
          onAddResourceClick={handleAddResource}
          allTopics={allTopics}
        />
      </div>

      {/* Modals */}
      <AddTopicModal
        isOpen={isAddTopicModalOpen}
        onClose={() => {
          setIsAddTopicModalOpen(false);
          handleModalClose();
        }}
        preselectedSubjectId={selectedSubjectId || undefined}
        preselectedParentId={addTopicParentId}
        onTopicAdded={handleModalClose}
      />

      <AddResourceFileModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
          handleModalClose();
        }}
        preselectedSubjectId={selectedSubjectId || undefined}
        preselectedTopicId={addResourceTopicId}
        onResourceAdded={handleModalClose}
      />

      <ViewTopicModal
        isOpen={isViewTopicModalOpen}
        onClose={() => {
          setIsViewTopicModalOpen(false);
          handleModalClose();
        }}
        topicId={viewTopicId}
        onTopicUpdated={handleModalClose}
      />
    </div>
  );
}
