'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopicsTable, AddTopicModal } from '@/features/topics';
import { Button } from '@altitutor/ui';
import { AdminLoadingSkeleton, AdminPageActionButton } from '@/shared/components';
import { Plus, ArrowLeft } from 'lucide-react';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';

export default function SubjectTopicsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { data: subjects = [], isLoading } = useSubjects();
  const subject = subjects.find(s => s.id === id);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleTopicAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleViewTopic = (topicId: string) => {
    router.push(`/subjects/${id}/topics/${topicId}`);
  };

  if (isLoading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  if (!subject) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/subjects')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Subject Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/subjects/${id}`)}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Topics & Files</h1>
        </div>
        <AdminPageActionButton
          icon={<Plus className="h-4 w-4" />}
          label="Add Topic"
          onClick={() => setIsAddModalOpen(true)}
        />
      </div>
      
      <TopicsTable 
        onRefresh={refreshCounter}
        onViewTopic={handleViewTopic}
        subjectId={id}
        basePath={`/subjects/${id}/topics`}
        hideSubjectFilter={true}
      />
      
      <AddTopicModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onTopicAdded={handleTopicAdded}
        preselectedSubjectId={id}
      />
    </div>
  );
}
