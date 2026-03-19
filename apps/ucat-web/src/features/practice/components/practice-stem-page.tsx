'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionEnginePage } from '@/features/question-engine'
import type { QuestionStemWithQuestions } from '@/features/question-engine/model/types'
import { UcatLagProvider } from '@/features/question-engine/context/ucat-lag-context'
import { fetchStemForPracticeSession } from '@/features/practice/lib/fetch-stem-for-practice'

type PracticeStemPageProps = {
  stemId: string
}

export function PracticeStemPage({ stemId }: PracticeStemPageProps) {
  const router = useRouter()
  const [stem, setStem] = useState<QuestionStemWithQuestions | null | 'loading' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchStemForPracticeSession(stemId)
        if (!cancelled) setStem(data)
      } catch {
        if (!cancelled) setStem('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stemId])

  if (stem === 'loading') {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (stem === 'error' || !stem) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">Could not load this question stem.</p>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => router.replace('/sessions')}
        >
          Back to sessions
        </button>
      </div>
    )
  }

  return (
    <UcatLagProvider>
      <QuestionEnginePage
        mode="questionStem"
        sourceId="session-stem"
        questionStems={[stem]}
        practice
        timePerQuestionSeconds={null}
        backHref="/sessions"
        onBack={() => router.push('/sessions')}
      />
    </UcatLagProvider>
  )
}
