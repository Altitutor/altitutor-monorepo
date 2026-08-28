'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input, SearchableSelect, Switch } from '@altitutor/ui'
import type { BlueprintAnswerScheme, BlueprintSectionCode } from '@altitutor/ucat-blueprint'
import { SegmentedTabPanel, SegmentedTabPanelContent } from '@/shared/components/segmented-tab-panel'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type {
  MockBlueprintCategoryRule,
  MockBlueprintPayload,
  MockBlueprintRow,
  MockBlueprintSectionPayload,
} from '@/features/ucat/mock-blueprints/types'

const SECTION_CONFIG: Array<{
  code: BlueprintSectionCode
  number: number
  shortLabel: string
  label: string
}> = [
  { code: 'verbal_reasoning', number: 1, shortLabel: 'VR', label: 'Verbal Reasoning' },
  { code: 'decision_making', number: 2, shortLabel: 'DM', label: 'Decision Making' },
  { code: 'quantitative_reasoning', number: 3, shortLabel: 'QR', label: 'Quantitative Reasoning' },
  { code: 'situational_judgement', number: 4, shortLabel: 'SJT', label: 'Situational Judgement' },
]

type SectionReference = {
  id?: string | null
  section_number?: number | null
  number_of_questions?: number | null
  time_limit_seconds?: number | null
  instructions_time_limit_seconds?: number | null
}

type CategoryReference = {
  id?: string | null
  name?: string | null
  ucat_section_id?: string | null
}

type CategoryRuleDraft = {
  key: string
  enabled: boolean
  categoryId?: string
  category?: string
  answerScheme?: BlueprintAnswerScheme
  requiredAnswerScheme?: BlueprintAnswerScheme
  label: string
  unit: 'questions' | 'stems'
  min: string
  preferred: string
  max: string
}

type SectionDraft = {
  section: BlueprintSectionCode
  sectionIndex: number
  exactQuestionCount: string
  answeringTimeSeconds: string
  instructionTimeSeconds: string
  categoryRules: CategoryRuleDraft[]
}

type BlueprintDraft = {
  testYear: string
  sections: SectionDraft[]
}

const UNIT_OPTIONS = [
  { value: 'questions' as const, label: 'Questions' },
  { value: 'stems' as const, label: 'Stems' },
]

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numberString(value: unknown, fallback = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
}

function existingSection(row: MockBlueprintRow | null, code: BlueprintSectionCode) {
  if (!Array.isArray(row?.sections)) return null
  return row.sections.map(objectRecord).find((section) => section?.section === code) ?? null
}

function existingCategoryRules(section: Record<string, unknown> | null): Record<string, unknown>[] {
  const policy = objectRecord(section?.altitutorCompositionPolicy)
  return Array.isArray(policy?.categoryRules)
    ? policy.categoryRules.map(objectRecord).filter((rule): rule is Record<string, unknown> => rule != null)
    : []
}

function buildDraft(
  row: MockBlueprintRow | null,
  sections: SectionReference[],
  categories: CategoryReference[],
): BlueprintDraft {
  return {
    testYear: String(row?.test_year ?? new Date().getFullYear()),
    sections: SECTION_CONFIG.map((config, sectionIndex) => {
      const section = sections.find((candidate) => candidate.section_number === config.number)
      const stored = existingSection(row, config.code)
      const storedRules = existingCategoryRules(stored)
      const sectionCategories = categories
        .filter((category) => category.id && category.ucat_section_id === section?.id)
        .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
      const categoryRules: CategoryRuleDraft[] = sectionCategories.map((category) => {
        const storedRule = storedRules.find((rule) =>
          rule.categoryId === category.id || (!rule.categoryId && rule.category === category.name),
        )
        return {
          key: category.id ?? '',
          enabled: storedRule != null,
          categoryId: category.id ?? undefined,
          category: category.name ?? 'Untitled category',
          requiredAnswerScheme: typeof storedRule?.requiredAnswerScheme === 'string'
            ? storedRule.requiredAnswerScheme as BlueprintAnswerScheme
            : undefined,
          label: category.name ?? 'Untitled category',
          unit: storedRule?.unit === 'stems' ? 'stems' : 'questions',
          min: numberString(storedRule?.min),
          preferred: numberString(storedRule?.preferred),
          max: numberString(storedRule?.max),
        }
      })
      const systemRules = storedRules.filter((rule) => !rule.category && typeof rule.answerScheme === 'string')
      if (config.code === 'situational_judgement') {
        const storedRating = systemRules.find((rule) => rule.answerScheme === 'situational_judgement_rating')
        categoryRules.push({
          key: 'system:situational_judgement_rating',
          enabled: storedRating != null,
          answerScheme: 'situational_judgement_rating',
          label: typeof storedRating?.label === 'string' ? storedRating.label : 'Rating questions',
          unit: storedRating?.unit === 'stems' ? 'stems' : 'questions',
          min: numberString(storedRating?.min),
          preferred: numberString(storedRating?.preferred),
          max: numberString(storedRating?.max),
        })
      }
      return {
        section: config.code,
        sectionIndex,
        exactQuestionCount: numberString(stored?.exactQuestionCount, numberString(section?.number_of_questions)),
        answeringTimeSeconds: numberString(stored?.answeringTimeSeconds, numberString(section?.time_limit_seconds)),
        instructionTimeSeconds: numberString(
          stored?.instructionTimeSeconds,
          numberString(section?.instructions_time_limit_seconds),
        ),
        categoryRules,
      }
    }),
  }
}

function nonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function positiveInteger(value: string): number | null {
  const parsed = nonNegativeInteger(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function validationError(draft: BlueprintDraft): string | null {
  const year = positiveInteger(draft.testYear)
  if (year == null || year < 2026) return 'Enter a test year of 2026 or later.'
  for (const section of draft.sections) {
    const label = SECTION_CONFIG.find((candidate) => candidate.code === section.section)?.label ?? section.section
    if (
      positiveInteger(section.exactQuestionCount) == null
      || positiveInteger(section.answeringTimeSeconds) == null
      || positiveInteger(section.instructionTimeSeconds) == null
    ) return `${label}: question total and timings must be positive whole numbers.`
    for (const rule of section.categoryRules.filter((candidate) => candidate.enabled)) {
      const min = nonNegativeInteger(rule.min)
      const max = nonNegativeInteger(rule.max)
      const preferred = rule.preferred.trim() === '' ? null : nonNegativeInteger(rule.preferred)
      if (min == null || max == null) return `${label} · ${rule.label}: minimum and maximum are required.`
      if (max < min) return `${label} · ${rule.label}: maximum must be at least the minimum.`
      if (rule.preferred.trim() !== '' && (preferred == null || preferred < min || preferred > max)) {
        return `${label} · ${rule.label}: ideal must be within the range.`
      }
    }
  }
  return null
}

function toPayload(draft: BlueprintDraft, source: MockBlueprintRow | null): MockBlueprintPayload {
  const testYear = Number(draft.testYear)
  return {
    sourceBlueprintId: source?.id ?? null,
    testYear,
    officialFactsLabel: source?.official_facts_label || `Official UCAT ANZ ${testYear} exact totals and timings`,
    altitutorPolicyLabel: source?.altitutor_policy_label || 'Altitutor-authored composition policy',
    sections: draft.sections.map((section): MockBlueprintSectionPayload => ({
      section: section.section,
      sectionIndex: section.sectionIndex,
      exactQuestionCount: Number(section.exactQuestionCount),
      answeringTimeSeconds: Number(section.answeringTimeSeconds),
      instructionTimeSeconds: Number(section.instructionTimeSeconds),
      categoryRules: section.categoryRules.filter((rule) => rule.enabled).map((rule): MockBlueprintCategoryRule => ({
        ...(rule.categoryId ? { categoryId: rule.categoryId, category: rule.category } : {}),
        ...(rule.answerScheme ? { answerScheme: rule.answerScheme, label: rule.label } : {}),
        ...(rule.requiredAnswerScheme ? { requiredAnswerScheme: rule.requiredAnswerScheme } : {}),
        unit: rule.unit,
        min: Number(rule.min),
        ...(rule.preferred.trim() === '' ? {} : { preferred: Number(rule.preferred) }),
        max: Number(rule.max),
      })),
    })),
  }
}

export function UcatMockBlueprintDialog({
  open,
  source,
  sections,
  categories,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean
  source: MockBlueprintRow | null
  sections: SectionReference[]
  categories: CategoryReference[]
  isSaving: boolean
  onClose: () => void
  onSave: (payload: MockBlueprintPayload) => Promise<void>
}) {
  const [activeSection, setActiveSection] = useState<BlueprintSectionCode>('verbal_reasoning')
  const [draft, setDraft] = useState<BlueprintDraft>(() => buildDraft(source, sections, categories))

  useEffect(() => {
    if (!open) return
    setActiveSection('verbal_reasoning')
    setDraft(buildDraft(source, sections, categories))
  }, [categories, open, sections, source])

  const error = useMemo(() => validationError(draft), [draft])

  function updateSection(code: BlueprintSectionCode, update: (current: SectionDraft) => SectionDraft) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => section.section === code ? update(section) : section),
    }))
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={source ? `Edit ${source.code}` : 'Create Mock Blueprint'}
      subtitle={source ? `Saving creates ${source.test_year} v${source.version + 1}; ${source.code} remains unchanged.` : 'Create an immutable UCAT mock blueprint version'}
      onSave={() => void onSave(toPayload(draft, source))}
      saveLabel={source ? 'Create new version' : 'Create blueprint'}
      saveDisabled={isSaving || error != null}
      isSaving={isSaving}
      defaultExpanded
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <label className="mb-5 block max-w-xs text-sm">
          <span className="mb-1 block font-medium">Test year</span>
          <Input
            type="number"
            min={2026}
            value={draft.testYear}
            disabled={source != null}
            onChange={(event) => setDraft((current) => ({ ...current, testYear: event.target.value }))}
          />
        </label>

        <SegmentedTabPanel
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as BlueprintSectionCode)}
          className="min-h-0 flex-1"
          selectorClassName="max-w-xl"
          options={SECTION_CONFIG.map((section) => ({ value: section.code, label: section.shortLabel }))}
        >
          {draft.sections.map((section) => {
            const config = SECTION_CONFIG.find((candidate) => candidate.code === section.section)
            return (
              <SegmentedTabPanelContent
                key={section.section}
                when={section.section}
                activeTab={activeSection}
                className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1"
              >
                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold">{config?.label}</h3>
                    <p className="text-sm text-muted-foreground">Official section facts</p>
                  </div>
                  <div className={tutorCardCn('grid gap-4 p-4 sm:grid-cols-3')}>
                    {[
                      ['exactQuestionCount', 'Questions'],
                      ['answeringTimeSeconds', 'Answering time (seconds)'],
                      ['instructionTimeSeconds', 'Instruction time (seconds)'],
                    ].map(([key, label]) => (
                      <label key={key} className="block text-sm">
                        <span className="mb-1 block font-medium">{label}</span>
                        <Input
                          type="number"
                          min={1}
                          value={section[key as keyof Pick<SectionDraft, 'exactQuestionCount' | 'answeringTimeSeconds' | 'instructionTimeSeconds'>]}
                          onChange={(event) => updateSection(section.section, (current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))}
                        />
                      </label>
                    ))}
                  </div>

                  <div>
                    <h3 className="font-semibold">Category composition</h3>
                    <p className="text-sm text-muted-foreground">Enable only categories this blueprint constrains. Ideal is optional.</p>
                  </div>
                  <div className="space-y-3">
                    {section.categoryRules.map((rule) => (
                      <div key={rule.key} className={tutorCardCn('p-4')}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{rule.label}</p>
                            {rule.answerScheme ? <p className="text-xs text-muted-foreground">System answer-scheme rule</p> : null}
                          </div>
                          <Switch
                            checked={rule.enabled}
                            aria-label={`Enable ${rule.label}`}
                            onCheckedChange={(enabled) => updateSection(section.section, (current) => ({
                              ...current,
                              categoryRules: current.categoryRules.map((candidate) => candidate.key === rule.key
                                ? { ...candidate, enabled }
                                : candidate),
                            }))}
                          />
                        </div>
                        {rule.enabled ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <label className="block text-sm">
                              <span className="mb-1 block font-medium">Count</span>
                              <SearchableSelect<(typeof UNIT_OPTIONS)[number]>
                                items={UNIT_OPTIONS}
                                value={UNIT_OPTIONS.find((item) => item.value === rule.unit) ?? UNIT_OPTIONS[0]}
                                onValueChange={(item) => item && updateSection(section.section, (current) => ({
                                  ...current,
                                  categoryRules: current.categoryRules.map((candidate) => candidate.key === rule.key
                                    ? { ...candidate, unit: item.value }
                                    : candidate),
                                }))}
                                getItemId={(item) => item.value}
                                getItemLabel={(item) => item.label}
                              />
                            </label>
                            {(['min', 'preferred', 'max'] as const).map((field) => (
                              <label key={field} className="block text-sm">
                                <span className="mb-1 block font-medium">
                                  {field === 'min' ? 'Minimum' : field === 'max' ? 'Maximum' : 'Ideal (optional)'}
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={rule[field]}
                                  onChange={(event) => updateSection(section.section, (current) => ({
                                    ...current,
                                    categoryRules: current.categoryRules.map((candidate) => candidate.key === rule.key
                                      ? { ...candidate, [field]: event.target.value }
                                      : candidate),
                                  }))}
                                />
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {section.categoryRules.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No categories are configured for this section.
                      </p>
                    ) : null}
                  </div>
                </div>
              </SegmentedTabPanelContent>
            )
          })}
        </SegmentedTabPanel>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </div>
    </UcatDialogShell>
  )
}

