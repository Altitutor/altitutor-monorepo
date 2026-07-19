'use client'

import { useEffect, useState } from 'react'
import { Label, Switch, useToast } from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'

export type UcatPdfExportSource =
  | { kind: 'set'; title: string; stemIds: string[] }
  | { kind: 'mock'; title: string; setIds: string[] }

function filenameFromDisposition(header: string | null, fallbackTitle: string) {
  const match = header?.match(/filename="([^"]+)"/i)
  if (match?.[1]) return match[1]
  const slug = fallbackTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'ucat-export'}.pdf`
}

export function UcatPdfExportDialog({
  open,
  onClose,
  source,
}: {
  open: boolean
  onClose: () => void
  source: UcatPdfExportSource
}) {
  const { toast } = useToast()
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const [repeatStems, setRepeatStems] = useState(false)
  const [avoidQuestionPageBreaks, setAvoidQuestionPageBreaks] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setIncludeAnswers(false)
      setRepeatStems(false)
      setAvoidQuestionPageBreaks(true)
      setIsExporting(false)
    }
  }, [open])

  const hasContent = source.kind === 'set' ? source.stemIds.length > 0 : source.setIds.length > 0

  async function handleExport() {
    setIsExporting(true)
    try {
      const response = await fetch('/api/ucat/pdf-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...source,
          options: { includeAnswers, repeatStems, avoidQuestionPageBreaks },
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(body.error ?? 'Failed to export PDF')
      }

      const blob = await response.blob()
      const exportMode = response.headers.get('X-Altitutor-PDF-Mode')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFromDisposition(response.headers.get('Content-Disposition'), source.title)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      onClose()
      toast({
        title: 'PDF exported',
        description: exportMode && exportMode !== 'rich'
          ? `${source.title} was downloaded using simplified formatting.`
          : `${source.title} was downloaded.`,
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export PDF',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title="Export as PDF"
      subtitle={
        source.kind === 'set'
          ? 'Choose how this set should be formatted.'
          : 'Choose how every set in this mock should be formatted.'
      }
      onSave={handleExport}
      saveLabel="Export"
      saveDisabled={!hasContent || isExporting}
      isSaving={isExporting}
      hideCancel={false}
    >
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-xl divide-y rounded-xl border bg-background">
          <div className="flex items-start justify-between gap-6 p-4">
            <div className="space-y-1">
              <Label htmlFor="pdf-include-answers" className="text-sm font-medium">
                Answers and explanations
              </Label>
              <p className="text-sm text-muted-foreground">
                Include the correct answer and authored explanations for every question.
              </p>
            </div>
            <Switch id="pdf-include-answers" checked={includeAnswers} onCheckedChange={setIncludeAnswers} />
          </div>
          <div className="flex items-start justify-between gap-6 p-4">
            <div className="space-y-1">
              <Label htmlFor="pdf-repeat-stems" className="text-sm font-medium">
                Repeat stems before each question
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the shared passage or scenario again before every question that uses it.
              </p>
            </div>
            <Switch id="pdf-repeat-stems" checked={repeatStems} onCheckedChange={setRepeatStems} />
          </div>
          <div className="flex items-start justify-between gap-6 p-4">
            <div className="space-y-1">
              <Label htmlFor="pdf-avoid-question-page-breaks" className="text-sm font-medium">
                Don&apos;t break questions over pages
              </Label>
              <p className="text-sm text-muted-foreground">
                Keep each question together on one page when its content fits.
              </p>
            </div>
            <Switch
              id="pdf-avoid-question-page-breaks"
              checked={avoidQuestionPageBreaks}
              onCheckedChange={setAvoidQuestionPageBreaks}
            />
          </div>
        </div>
      </div>
    </UcatDialogShell>
  )
}
