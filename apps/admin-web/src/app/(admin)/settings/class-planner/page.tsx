'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClassPlansTable } from '@/features/class-planner/components/ClassPlansTable';
import { CreatePlanModal } from '@/features/class-planner/components/CreatePlanModal';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function ClassPlannerPage() {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <ClassPlansTable onCreatePlan={() => setIsCreateModalOpen(true)} />
      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
