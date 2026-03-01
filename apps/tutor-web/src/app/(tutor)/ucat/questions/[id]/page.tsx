import { UcatQuestionStemDetailPage } from '@/features/ucat/questions/components/UcatQuestionStemDetailPage'

export default async function UcatQuestionStemDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <UcatQuestionStemDetailPage stemId={id} />
}

