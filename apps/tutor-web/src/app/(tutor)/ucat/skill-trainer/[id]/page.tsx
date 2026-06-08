import { UcatSkillTrainerItemDetailPage } from '@/features/ucat/skill-trainer/components/UcatSkillTrainerItemDetailPage'

export default function UcatSkillTrainerItemRoute({ params }: { params: { id: string } }) {
  return <UcatSkillTrainerItemDetailPage itemId={params.id} />
}
