import { redirect } from 'next/navigation'

export default async function UcatQuestionStemDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ucat/questions?edit=${id}`)
}

