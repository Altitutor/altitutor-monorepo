'use client';

import { Suspense, useState } from 'react';
import { SegmentedControl } from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';
import { Plus } from 'lucide-react';
import { ProjectsBoard } from '@/features/projects/components/ProjectsBoard';
import { ProjectsList } from '@/features/projects/components/ProjectsList';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

const PROJECT_VIEWS = ['kanban', 'list'] as const;

function ProjectsPageContent() {
  const [view, setView] = useAdminPageViewParam(PROJECT_VIEWS, 'kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-4">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as (typeof PROJECT_VIEWS)[number])}
            options={[
              { value: 'kanban', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New Project"
            onClick={() => setIsCreateDialogOpen(true)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? <ProjectsBoard /> : <ProjectsList />}
      </div>

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onProjectCreated={(projectId) => {
          setSelectedProjectId(projectId);
          setIsEditDialogOpen(true);
        }}
      />

      {selectedProjectId && (
        <EditProjectDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedProjectId(null);
          }}
          projectId={selectedProjectId}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageContent />
    </Suspense>
  );
}
