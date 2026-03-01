 'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { sectionLabels } from '@/features/set-generator/model/mock-data'
import type { SectionKey, SetGeneratorInput, TimeMode } from '@/features/set-generator/model/types'

const DEFAULT_QUESTION_COUNT = 20

const initialInput: SetGeneratorInput = {
  sections: ['verbal_reasoning'],
  unansweredOnly: true,
  incorrectOnly: false,
  // Difficulty band between 0 and 1
  difficultyMin: 0,
  difficultyMax: 1,
  categoryIds: [],
  timeMode: 'exam',
  customTimeMinutes: null,
  questionCount: DEFAULT_QUESTION_COUNT,
}

export function SetGeneratorPage() {
  const [input, setInput] = useState<SetGeneratorInput>(initialInput)
  const router = useRouter()

  const generateMutation = useMutation({
    mutationFn: async (payload: SetGeneratorInput) => {
      const response = await fetch('/api/ucat/generated-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: payload }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = body.error ?? 'Failed to generate practice set'
        throw new Error(message)
      }

      return (await response.json()) as {
        setId: string
        questionCount: number
        totalMatchingQuestions: number
        examTimeSeconds: number | null
      }
    },
    onSuccess: (data) => {
      router.push(`/sets/${encodeURIComponent(data.setId)}`)
    },
  })

  const selectedSectionLabels = useMemo(
    () => input.sections.map((section) => sectionLabels[section]).join(', '),
    [input.sections]
  )

  const handleToggleSection = (section: SectionKey) => {
    setInput((current) => {
      const exists = current.sections.includes(section)
      const sections = exists
        ? current.sections.filter((s) => s !== section)
        : [...current.sections, section]

      return {
        ...current,
        sections: sections.length > 0 ? sections : ['verbal_reasoning'],
      }
    })
  }

  const handleToggleUnanswered = (checked: boolean) => {
    setInput((current) => ({
      ...current,
      unansweredOnly: checked,
      incorrectOnly: checked ? false : current.incorrectOnly,
    }))
  }

  const handleToggleIncorrect = (checked: boolean) => {
    setInput((current) => ({
      ...current,
      incorrectOnly: checked,
      unansweredOnly: checked ? false : current.unansweredOnly,
    }))
  }

  const handleTimeModeChange = (mode: TimeMode) => {
    setInput((current) => ({
      ...current,
      timeMode: mode,
      // Reset custom time when switching away from custom
      customTimeMinutes: mode === 'custom' ? current.customTimeMinutes ?? 60 : null,
    }))
  }

  const handleDifficultyChange = (kind: 'min' | 'max', value: number) => {
    setInput((current) => {
      const clamped = Math.min(1, Math.max(0, value))
      if (kind === 'min') {
        return {
          ...current,
          difficultyMin: Math.min(clamped, current.difficultyMax),
        }
      }
      return {
        ...current,
        difficultyMax: Math.max(clamped, current.difficultyMin),
      }
    })
  }

  const handleQuestionCountChange = (value: number) => {
    const safeValue = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_QUESTION_COUNT
    setInput((current) => ({
      ...current,
      questionCount: safeValue,
    }))
  }

  const handleGenerateClick = () => {
    if (generateMutation.isPending) return
    generateMutation.mutate(input)
  }

  return (
    <UcatPagePlaceholder
      title="Set Generator"
      description="Build a targeted practice set from section, timing, difficulty, and performance filters."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filters</h2>

          {/* Sections */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Sections</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(sectionLabels) as SectionKey[]).map((section) => {
                const checked = input.sections.includes(section)
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => handleToggleSection(section)}
                    className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      checked ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    {sectionLabels[section]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time mode */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Time</p>
            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
              {([
                { mode: 'off', label: 'Off' },
                { mode: 'exam', label: 'Exam' },
                { mode: 'custom', label: 'Custom' },
              ] as const).map((item) => {
                const isActive = input.timeMode === item.mode
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleTimeModeChange(item.mode)}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-sidebar text-sidebar-foreground'
                        : 'text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {input.timeMode === 'custom' ? (
              <div className="space-y-1 text-xs">
                {/* Exam time hint will be wired once backend preview is implemented */}
                <p className="text-muted-foreground">
                  Exam timing estimate will appear here as a guide once generation logic is wired.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Custom time limit</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={input.customTimeMinutes ?? ''}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        customTimeMinutes: event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                    className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">minutes</span>
                </label>
              </div>
            ) : null}
          </div>

          {/* Difficulty slider */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Difficulty</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={input.difficultyMin}
                onChange={(event) => handleDifficultyChange('min', Number(event.target.value))}
                className="w-full"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={input.difficultyMax}
                onChange={(event) => handleDifficultyChange('max', Number(event.target.value))}
                className="w-full"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Selected range: {input.difficultyMin.toFixed(2)} – {input.difficultyMax.toFixed(2)}
            </p>
          </div>

          {/* Categories (placeholder; will be wired to real data) */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Categories</p>
            <p className="text-xs text-muted-foreground">
              Category filters will be populated from UCAT stem categories and scoped to the selected sections.
            </p>
          </div>

          {/* Performance toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.unansweredOnly}
                onChange={(event) => handleToggleUnanswered(event.target.checked)}
              />
              Show only unanswered
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.incorrectOnly}
                onChange={(event) => handleToggleIncorrect(event.target.checked)}
              />
              Show only incorrect
            </label>
            <p className="text-xs text-muted-foreground">
              These toggles are mutually exclusive. Turning one on will turn the other off.
            </p>
          </div>

          {/* Question count */}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Question count</span>
            <input
              type="number"
              min={1}
              max={200}
              value={input.questionCount}
              onChange={(event) => handleQuestionCountChange(Number(event.target.value))}
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
            />
            <span className="block text-xs text-muted-foreground">
              This will be capped by the total number of questions across your selected sections.
            </span>
          </label>
        </section>

        {/* Preview + actions */}
        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preview</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Sections:</span> {selectedSectionLabels}
            </p>
            <p>
              <span className="font-medium">Questions:</span>{' '}
              {/* Once wired, replace with "{input.questionCount} / {totalMatchingQuestions}" */}
              {input.questionCount} / ?
            </p>
            <p>
              <span className="font-medium">Time:</span>{' '}
              {input.timeMode === 'off'
                ? 'No time limit'
                : input.timeMode === 'exam'
                  ? 'Exam timing (auto-calculated)'
                  : input.customTimeMinutes != null
                    ? `${input.customTimeMinutes} minute${input.customTimeMinutes === 1 ? '' : 's'} (custom)`
                    : 'Custom (minutes not set)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={generateMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground disabled:opacity-60"
            >
              {generateMutation.isPending ? 'Generating…' : 'Generate set'}
            </button>
            <Link
              href="/mocks"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Use set in mock mode
            </Link>
          </div>
        </section>
      </div>
    </UcatPagePlaceholder>
  )
}
