'use client'

import { UcatSkillTrainerSetDetailPage } from '@/features/ucat/skill-trainer-sets'

export default function UcatSkillTrainerSetDetailRoute({ params }: { params: { id: string } }) {
  return <UcatSkillTrainerSetDetailPage setId={params.id} />
}
