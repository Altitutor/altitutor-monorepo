import { redirect } from 'next/navigation'

export default async function UcatSkillTrainerItemLegacyRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (id === 'new') {
    redirect('/ucat/skill-trainer-questions')
  }
  redirect(`/ucat/skill-trainer-questions?edit=${encodeURIComponent(id)}`)
}
