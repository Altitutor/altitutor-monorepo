import { MockAttemptDetailPage } from '@/features/progress'

type PageProps = {
  params: { id: string }
}

export default function Page({ params }: PageProps) {
  return <MockAttemptDetailPage mockAttemptId={params.id} />
}
