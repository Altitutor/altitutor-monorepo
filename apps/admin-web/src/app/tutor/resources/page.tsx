'use client';

import { TopicsTable } from '@/features/topics/components';

export default function TutorResourcesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
      </div>
      <TopicsTable />
    </div>
  );
}


