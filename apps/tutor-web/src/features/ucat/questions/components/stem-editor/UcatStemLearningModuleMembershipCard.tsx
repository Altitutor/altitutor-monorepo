'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ucatLearningModulesApi } from '@/features/ucat/learning-modules/api/modules'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function UcatStemLearningModuleMembershipCard({
  stemId,
  highlighted = false,
}: {
  stemId: string | null | undefined
  highlighted?: boolean
}) {
  const [viewingModuleId, setViewingModuleId] = useState<string | null>(null)

  const membershipQuery = useQuery({
    queryKey: stemId
      ? ucatKeys.learningModuleStemMembership(stemId)
      : [...ucatKeys.learningModules(), 'stem-membership', 'empty'],
    queryFn: () => ucatLearningModulesApi.listStemMembership(stemId as string),
    enabled: !!stemId,
  })

  if (!stemId) return null

  const currentModules = membershipQuery.data ?? []

  return (
    <>
      {highlighted ? (
        <p className="text-xs text-amber-900 dark:text-amber-100">
          Check whether this private stem is already in a learning module lesson.
        </p>
      ) : null}

      {membershipQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading learning module membership...</p>
      ) : currentModules.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not in any learning module lesson.</p>
      ) : (
        <ul className="space-y-1">
          {currentModules.map((module) => (
            <li key={module.moduleId}>
              <button
                type="button"
                className="w-full truncate rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/60"
                onClick={() => setViewingModuleId(module.moduleId)}
              >
                {module.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <UcatLearningModuleDialog
        open={!!viewingModuleId}
        moduleId={viewingModuleId}
        onClose={() => setViewingModuleId(null)}
      />
    </>
  )
}
