'use client';

import { useState } from 'react';
import { TopicsTable, AddTopicModal } from '@/features/topics';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function TopicsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleTopicAdded = () => {
    // Increment the counter to trigger a refresh in the table
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Topics & Resources</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic
        </Button>
      </div>
      
      <TopicsTable onRefresh={refreshCounter} />
      
      <AddTopicModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onTopicAdded={handleTopicAdded}
      />
    </div>
  );
} 