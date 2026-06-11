'use client'

import { UcatLearningModuleDetailPage } from '@/features/ucat/learning-modules'

export default function UcatLearningModuleDetailRoute({ params }: { params: { id: string } }) {
  return <UcatLearningModuleDetailPage moduleId={params.id} />
}
