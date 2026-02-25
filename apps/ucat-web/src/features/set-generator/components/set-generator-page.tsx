'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { generatedSetPreview, sectionLabels } from '@/features/set-generator/model/mock-data'
import type { SectionKey, SetGeneratorInput } from '@/features/set-generator/model/types'

const initialInput: SetGeneratorInput = {
  sections: ['verbal_reasoning'],
  unansweredOnly: true,
  incorrectOnly: false,
  difficultyMin: 1,
  difficultyMax: 5,
  questionCount: 20,
}

export function SetGeneratorPage() {
  const [input, setInput] = useState<SetGeneratorInput>(initialInput)

  const selectedSectionLabels = useMemo(
    () => input.sections.map((section) => sectionLabels[section]).join(', '),
    [input.sections]
  )

  function toggleSection(section: SectionKey) {
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

  return (
    <UcatPagePlaceholder
      title="Set Generator"
      description="Build a targeted practice set from section and difficulty filters."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filters</h2>

          <div className="space-y-2">
            <p className="text-sm font-medium">Sections</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(sectionLabels) as SectionKey[]).map((section) => {
                const checked = input.sections.includes(section)
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => toggleSection(section)}
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

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.unansweredOnly}
                onChange={(event) => setInput((current) => ({ ...current, unansweredOnly: event.target.checked }))}
              />
              Unanswered questions only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.incorrectOnly}
                onChange={(event) => setInput((current) => ({ ...current, incorrectOnly: event.target.checked }))}
              />
              Previously incorrect only
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Min difficulty</span>
              <input
                type="number"
                min={1}
                max={5}
                value={input.difficultyMin}
                onChange={(event) =>
                  setInput((current) => ({ ...current, difficultyMin: Number(event.target.value || 1) }))
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Max difficulty</span>
              <input
                type="number"
                min={1}
                max={5}
                value={input.difficultyMax}
                onChange={(event) =>
                  setInput((current) => ({ ...current, difficultyMax: Number(event.target.value || 5) }))
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Question count</span>
            <input
              type="number"
              min={5}
              max={80}
              value={input.questionCount}
              onChange={(event) => setInput((current) => ({ ...current, questionCount: Number(event.target.value || 20) }))}
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preview</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Sections:</span> {selectedSectionLabels}
            </p>
            <p>
              <span className="font-medium">Questions:</span> {generatedSetPreview.questions}
            </p>
            <p>
              <span className="font-medium">Estimated time:</span> {generatedSetPreview.estimatedMinutes} minutes
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sets"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground"
            >
              Generate and start set
            </Link>
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
