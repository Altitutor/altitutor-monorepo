'use client';

import { ProjectDetailPage } from '@/features/projects/components/ProjectDetailPage';

export default function ProjectDetailRoute({ params }: { params: { id: string } }) {
  return <ProjectDetailPage projectId={params.id} />;
}
