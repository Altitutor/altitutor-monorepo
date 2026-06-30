'use client';

import { useState } from 'react';
import { ClassPlansTable } from '@/features/class-planner/components/ClassPlansTable';
import { CreatePlanModal } from '@/features/class-planner/components/CreatePlanModal';
import { Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export default function ClassPlannerPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <SettingsPageHeader
        title="Class Planner"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Create Class Plan"
            onClick={() => setIsCreateModalOpen(true)}
          />
        )}
      />
      <ClassPlansTable onCreatePlan={() => setIsCreateModalOpen(true)} />
      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
