'use client';

import { useState } from 'react';
import {
  TopicsTable,
  AddTopicModal,
} from '@/features/topics';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';

export default function TopicsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleTopicAdded = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Topics & Files</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic
        </Button>
      </div>
      
      <TopicsTable 
        onRefresh={refreshCounter} 
      />
      
      <AddTopicModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onTopicAdded={handleTopicAdded}
      />
    </div>
  );
}
