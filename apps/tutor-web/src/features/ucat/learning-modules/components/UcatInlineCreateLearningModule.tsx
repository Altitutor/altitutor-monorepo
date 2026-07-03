'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Folder } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui'
import { cn } from '@/shared/utils'
import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'

export function UcatInlineCreateLearningModule({
  sectionId,
  parentId,
  indent = 0,
  onCreate,
}: {
  sectionId: string | null
  parentId: string | null
  indent?: number
  onCreate: (params: {
    kind: UcatLearningModuleKind
    title: string
    sectionId: string | null
    parentId: string | null
  }) => Promise<void>
}) {
  const [mode, setMode] = useState<'idle' | 'naming'>('idle')
  const [kind, setKind] = useState<UcatLearningModuleKind>('lesson')
  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'naming') inputRef.current?.focus()
  }, [mode])

  const resetIdle = useCallback(() => {
    setMode('idle')
    setTitle('')
  }, [])

  const handlePickKind = useCallback((nextKind: UcatLearningModuleKind) => {
    setKind(nextKind)
    setTitle('')
    setMode('naming')
  }, [])

  const handleSave = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed || isSaving) return
    setIsSaving(true)
    try {
      await onCreate({ kind, title: trimmed, sectionId, parentId })
      resetIdle()
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, kind, onCreate, parentId, resetIdle, sectionId, title])

  const rowStyle = { paddingLeft: `${indent + 10}px` } as const

  if (mode === 'naming') {
    return (
      <div className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-sm')} style={rowStyle}>
        <Input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === 'folder' ? 'Folder name...' : 'Module title...'}
          className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={isSaving}
          aria-label={kind === 'folder' ? 'New folder title' : 'New learning module title'}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSave()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              resetIdle()
            }
          }}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={resetIdle}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!title.trim() || isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full rounded-md px-2 py-1 text-left text-sm text-muted-foreground opacity-70',
            'hover:bg-muted/50 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          style={rowStyle}
        >
          + New learning module
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => handlePickKind('lesson')}>
          <BookOpen className="mr-2 h-4 w-4" />
          Create learning module
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePickKind('folder')}>
          <Folder className="mr-2 h-4 w-4" />
          Create folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
