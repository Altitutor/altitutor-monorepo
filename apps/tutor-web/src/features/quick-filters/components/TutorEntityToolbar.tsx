'use client'

import type { DisplaySettings } from '@altitutor/shared'
import { DataTableToolbar, type DataTableToolbarProps } from '@altitutor/ui'
import { useTutorSavedViews } from '../hooks/useTutorSavedViews'

export function TutorEntityToolbar({
  pageKey,
  defaultViewName = 'All',
  defaultSettings,
  ...props
}: Omit<DataTableToolbarProps, 'quickFilters' | 'viewTarget'> & {
  pageKey: string
  defaultViewName?: string
  defaultSettings: DisplaySettings
}) {
  const views = useTutorSavedViews(pageKey, { name: defaultViewName, settings: defaultSettings })
  return <DataTableToolbar {...props} quickFilters={views.data} viewTarget={views.target} />
}
