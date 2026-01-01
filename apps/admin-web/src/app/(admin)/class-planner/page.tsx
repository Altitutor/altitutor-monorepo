'use client';

import { useState } from 'react';
import { ClassPlansTable } from '@/features/class-planner/components/ClassPlansTable';
import { CreatePlanModal } from '@/features/class-planner/components/CreatePlanModal';

export default function ClassPlannerPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <ClassPlansTable onCreatePlan={() => setIsCreateModalOpen(true)} />
      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
