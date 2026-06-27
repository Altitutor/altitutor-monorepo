'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  TopicsTable,
  AddTopicModal,
  ViewTopicModal,
} from '@/features/topics';
import { AdminPageActionButton } from '@/shared/components';
import { Plus } from 'lucide-react';

export default function TopicsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    const viewTopicId = searchParams.get('view');
    if (viewTopicId) {
      setSelectedTopicId(viewTopicId);
      setIsViewModalOpen(true);
    }
  }, [searchParams]);

  const handleTopicAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const handleViewTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedTopicId(null);
    router.push('/topics');
  };

  const handleTopicUpdated = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Topics & Files</h1>
        <AdminPageActionButton
          icon={<Plus className="h-4 w-4" />}
          label="Add Topic"
          onClick={() => setIsAddModalOpen(true)}
        />
      </div>
      
      <Suspense fallback={null}>
        <TopicsTable 
          onRefresh={refreshCounter}
          onViewTopic={handleViewTopic}
        />
      </Suspense>
      
      <AddTopicModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onTopicAdded={handleTopicAdded}
      />

      <ViewTopicModal
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        topicId={selectedTopicId}
        onTopicUpdated={handleTopicUpdated}
      />
    </div>
  );
}
