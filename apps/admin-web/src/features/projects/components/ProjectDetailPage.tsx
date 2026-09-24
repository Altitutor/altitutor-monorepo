'use client';

import { useRouter } from 'next/navigation';
import { ProjectDetailView } from './ProjectDetailView';

interface ProjectDetailPageProps {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <ProjectDetailView
        projectId={projectId}
        enabled
        variant="page"
        onClose={() => router.push('/projects')}
      />
    </div>
  );
}
