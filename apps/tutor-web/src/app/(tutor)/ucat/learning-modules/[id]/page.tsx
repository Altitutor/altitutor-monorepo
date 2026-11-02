'use client';
import { use } from "react";

import { UcatLearningModuleDetailPage } from '@/features/ucat/learning-modules'

export default function UcatLearningModuleDetailRoute(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <UcatLearningModuleDetailPage moduleId={params.id} />
}
