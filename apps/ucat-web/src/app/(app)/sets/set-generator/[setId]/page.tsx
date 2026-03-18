import { SetDetailPage } from '@/features/sets'

type PageProps = {
  params: Promise<{ setId: string }>
}

export default async function SetGeneratorSetDetailRoute({ params }: PageProps) {
  const { setId } = await params
  return (
    <SetDetailPage
      setId={setId}
      backHref="/sets/set-generator"
      backLabel="Back to set generator"
    />
  )
}
