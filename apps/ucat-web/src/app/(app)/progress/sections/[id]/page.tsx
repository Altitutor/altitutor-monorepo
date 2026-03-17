import { Suspense } from 'react'
import { SectionProgressPage } from '@/features/progress'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<SectionProgressSkeleton />}>
      <SectionProgressPage sectionId={id} />
    </Suspense>
  )
}

function SectionProgressSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-48 rounded bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted" />
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  )
}
