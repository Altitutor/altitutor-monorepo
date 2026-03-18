import { SetAttemptDetailPage } from '@/features/progress'

type PageProps = {
  params: { id: string; setAttemptId: string }
}

export default function Page({ params }: PageProps) {
  return (
    <SetAttemptDetailPage
      attemptId={params.setAttemptId}
      mockAttemptId={params.id}
      backHref={`/progress/mock-attempts/${params.id}`}
      backLabel="Back to mock attempt"
    />
  )
}
