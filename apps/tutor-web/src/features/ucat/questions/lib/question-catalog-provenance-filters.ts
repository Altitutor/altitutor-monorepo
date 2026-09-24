import type {
  DataTableFilterDefinition,
  DataTableFilterOption,
} from '@altitutor/shared'

const sourceFilterDefinition: DataTableFilterDefinition<string> = {
  key: 'source_channel',
  label: 'Source',
  options: [
    { label: 'Individual add', value: 'individual' },
    { label: 'Bulk import', value: 'bulk_import' },
    { label: 'AI generation', value: 'ai_generation' },
  ],
}

const createdByFilterDefinition: DataTableFilterDefinition<string> = {
  key: 'created_by',
  label: 'Created by',
}

export function buildQuestionCatalogProvenanceFilters(
  createdByOptions: DataTableFilterOption<string>[],
): DataTableFilterDefinition<string>[] {
  return [
    sourceFilterDefinition,
    { ...createdByFilterDefinition, options: createdByOptions },
  ]
}
