import { PracticeAttemptDetailPage } from '@/features/progress'

type PageProps = {
  params: { id: string }
}

export default function Page({ params }: PageProps) {
  return <PracticeAttemptDetailPage attemptId={params.id} />
}
