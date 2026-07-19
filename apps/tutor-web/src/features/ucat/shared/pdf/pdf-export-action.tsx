import { FileDown } from 'lucide-react'
import type { UcatRowAction } from '@/features/ucat/shared/row-actions'

export function buildUcatPdfExportAction(onClick: () => void): UcatRowAction {
  return {
    label: 'Export as PDF',
    icon: <FileDown className="h-4 w-4" />,
    onClick,
  }
}
