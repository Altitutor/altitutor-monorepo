'use client'

import { Tabs, TabsList, TabsTrigger } from '@altitutor/ui'

export type UcatAuthoringWorkspaceTab = 'editor' | 'properties' | 'ai'

export function UcatAuthoringWorkspaceTabs({
  value,
  onValueChange,
  editorLabel,
  aiAvailable = true,
  className,
}: {
  value: UcatAuthoringWorkspaceTab
  onValueChange: (value: UcatAuthoringWorkspaceTab) => void
  editorLabel: string
  aiAvailable?: boolean
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as UcatAuthoringWorkspaceTab)} className={className}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="editor">{editorLabel}</TabsTrigger>
        <TabsTrigger value="properties">Properties</TabsTrigger>
        <TabsTrigger value="ai" disabled={!aiAvailable}>AI tools</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
