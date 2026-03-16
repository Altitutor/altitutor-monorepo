import { SectionProgressPage } from '@/features/progress'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return <SectionProgressPage sectionId={id} />
}
