'use client';

import { PlanEditor } from '@/features/class-planner/components/PlanEditor';

export default function ClassPlanEditorPage({ params }: { params: { planId: string } }) {
  return <PlanEditor planId={params.planId} />;
}
