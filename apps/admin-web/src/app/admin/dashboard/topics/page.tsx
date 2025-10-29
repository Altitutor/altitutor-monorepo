'use client';

import { useState, useMemo } from 'react';
import {
  TopicsHierarchy,
  AddTopicModal,
  AddResourceFileModal,
  ViewTopicModal,
  EditTopicFileModal,
} from '@/features/topics';
import { Button, Input } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { ArrowLeft, Search, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useTopics } from '@/features/topics/hooks';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TopicsPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  
  // Modals state
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [addTopicParentId, setAddTopicParentId] = useState<string | undefined>(undefined);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [addResourceTopicId, setAddResourceTopicId] = useState<string | undefined>(undefined);
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [isViewTopicModalOpen, setIsViewTopicModalOpen] = useState(false);
  const [isEditFileModalOpen, setIsEditFileModalOpen] = useState(false);
  const [editFileTopicFileId, setEditFileTopicFileId] = useState<string | null>(null);
  const [editFileTopicId, setEditFileTopicId] = useState<string | null>(null);
  const [editFileSubjectId, setEditFileSubjectId] = useState<string | null>(null);

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

  const handleEditFileClick = (topicFileId: string, topicId: string, subjectId: string) => {
    setEditFileTopicFileId(topicFileId);
    setEditFileTopicId(topicId);
    setEditFileSubjectId(subjectId);
    setIsEditFileModalOpen(true);
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
      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block">Select Subject</label>
        <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full max-w-md justify-between">
              {selectedSubjectId
                ? formatSubjectDisplay(subjects.find((s) => s.id === selectedSubjectId)!)
                : 'Select a subject'}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <div className="p-3">
              <Input
                placeholder="Search subjects..."
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {subjectsLoading ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Loading subjects...
                    </div>
                  ) : filteredSubjects.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {subjectSearchQuery ? 'No subjects match your search' : 'No subjects found'}
                    </div>
                  ) : (
                    filteredSubjects.map((subject) => (
                      <Button
                        key={subject.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setIsSubjectPopoverOpen(false);
                          setSubjectSearchQuery('');
                        }}
                      >
                        <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
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
          showAddTopic={false}
          showAddResource={false}
          onTopicClick={handleTopicClick}
          onAddTopicClick={handleAddTopic}
          onAddResourceClick={handleAddResource}
          onEditFileClick={handleEditFileClick}
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

      {editFileTopicFileId && editFileTopicId && editFileSubjectId && (
        <EditTopicFileModal
          isOpen={isEditFileModalOpen}
          onClose={() => {
            setIsEditFileModalOpen(false);
            setEditFileTopicFileId(null);
            setEditFileTopicId(null);
            setEditFileSubjectId(null);
            handleModalClose();
          }}
          topicFileId={editFileTopicFileId}
          currentTopicId={editFileTopicId}
          currentSubjectId={editFileSubjectId}
        />
      )}
    </div>
  );
}
