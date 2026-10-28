'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tutorViewEntity, withBuiltinSavedView, type DisplaySettings } from '@altitutor/shared'
import { tutorViewsApi } from '../api/tutor-views'

export function useTutorSavedViews(
  pageKey: string,
  defaultView: { name: string; settings: DisplaySettings },
) {
  const target = tutorViewEntity(pageKey)
  const query = useQuery({
    queryKey: ['tutor-quick-filters', target],
    queryFn: () => tutorViewsApi.list(target),
  })
  const settingsKey = JSON.stringify(defaultView.settings)
  const data = useMemo(
    () => withBuiltinSavedView(target, query.data, {
      name: defaultView.name,
      settings: JSON.parse(settingsKey) as DisplaySettings,
    }),
    [defaultView.name, query.data, settingsKey, target],
  )
  return { ...query, data, target }
}
