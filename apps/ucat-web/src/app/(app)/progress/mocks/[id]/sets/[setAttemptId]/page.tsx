import { SetAttemptDetailPage } from '@/features/progress'

type PageProps = {
  params: { id: string; setAttemptId: string }
}

export default function Page({ params }: PageProps) {
  return (
    <SetAttemptDetailPage
      attemptId={params.setAttemptId}
      backHref={`/progress/mocks/${params.id}`}
      backLabel="Back to mock attempt"
    />
  )
}
