'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@altitutor/ui'
import { Palette } from 'lucide-react'
import {
  ParseLegendList,
  type BulkImportParseLegendVariant,
} from '@/features/ucat/questions/components/bulk-import/bulkImportParseLegend'

type BulkImportParseLegendButtonProps = {
  variant: BulkImportParseLegendVariant
  includeExplanationsOnImport?: boolean
}

const LEGEND_LABEL: Record<BulkImportParseLegendVariant, string> = {
  stem_split: 'Editor highlight colors for stem splits',
  questions: 'Editor highlight colors for pasted questions',
  answers: 'Editor highlight colors for pasted answers',
}

export function BulkImportParseLegendButton({
  variant,
  includeExplanationsOnImport = true,
}: BulkImportParseLegendButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          aria-label={LEGEND_LABEL[variant]}
        >
          <Palette className="h-3.5 w-3.5" />
          Legend
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-3" align="end">
        <DropdownMenuLabel className="px-0 text-xs font-semibold text-foreground">
          Highlight legend
        </DropdownMenuLabel>
        <div className="mt-2 text-xs leading-snug text-foreground">
          <ParseLegendList
            variant={variant}
            includeExplanationsOnImport={includeExplanationsOnImport}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
