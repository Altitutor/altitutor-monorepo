'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useBulkImportWizard,
  type BulkImportStemDraft,
} from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useUcatCategories,
  useUcatSections,
  useUcatTags,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { Step1ChooseSection } from '@/features/ucat/questions/components/bulk-import/Step1ChooseSection'
import { Step2PasteDocument } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import { Step3EditQuestionStems } from '@/features/ucat/questions/components/bulk-import/Step3EditQuestionStems'
import { Step4ReviewAndSubmit } from '@/features/ucat/questions/components/bulk-import/Step4ReviewAndSubmit'
import {
  UcatQuestionStemDialog,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import {
  parseVerbalReasoningFromDoc,
  mapParsedVerbalReasoningToFormValues,
} from '@/features/ucat/questions/lib/verbalReasoningParser'

type BulkImportQuestionStemsModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (args: { sectionId: string; stems: UcatQuestionStemFormValues[] }) => Promise<void>
}

export function BulkImportQuestionStemsModal({
  open,
  onClose,
  onSubmit,
}: BulkImportQuestionStemsModalProps) {
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()

  const wizard = useBulkImportWizard()

  const [step, setStep] = useState(0)
  const totalSteps = 4
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [pastedContent, setPastedContent] = useState<Json | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Reset wizard and local state when modal closes. Only depend on open so we don't
  // re-run on every render (wizard is a new object each time from useBulkImportWizard).
  useEffect(() => {
    if (!open) {
      setStep(0)
      setStatus('idle')
      setSubmitError(null)
      setSectionId(null)
      setPastedContent(null)
      setParseError(null)
      wizard.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when open changes; wizard.reset is stable
  }, [open])

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = categoriesQuery.data ?? []
  const tags = tagsQuery.data ?? []

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId]
  )

  const isVerbalReasoningSection = selectedSection?.name === 'Verbal Reasoning'

  const canGoPrevious = useMemo(() => step > 0 && status !== 'submitting', [step, status])
  const canGoNext = useMemo(() => {
    if (status === 'submitting') return false
    if (step === 0) return !!sectionId
    if (step === 1 && isVerbalReasoningSection && (pastedContent == null || wizard.state.stems.length === 0)) {
      // Require successful parsing before moving on for Verbal Reasoning.
      return false
    }
    if (step >= totalSteps - 1) return false
    return true
  }, [step, status, sectionId, totalSteps, isVerbalReasoningSection, pastedContent, wizard.state.stems.length])

  const isLoadingMeta =
    sectionsQuery.isLoading || categoriesQuery.isLoading || tagsQuery.isLoading

  const hasErrorMeta =
    sectionsQuery.isError || categoriesQuery.isError || tagsQuery.isError

  function handleRequestClose() {
    if (status === 'submitting') return
    onClose()
  }

  function handleParseVerbalReasoning() {
    if (!isVerbalReasoningSection) return
    if (!sectionId) return
    try {
      const parsed = parseVerbalReasoningFromDoc(pastedContent)
      const forms = mapParsedVerbalReasoningToFormValues(parsed, {
        sectionId,
        categoryId: null,
        isPrivate: false,
      })

      if (forms.length === 0) {
        setParseError('No valid stems and questions were detected. Please check the formatting.')
        wizard.setStems([])
        return
      }

      wizard.setStems(forms)
      setParseError(null)
    } catch (error) {
      setParseError(
        error instanceof Error
          ? `Failed to parse Verbal Reasoning passage: ${error.message}`
          : 'Failed to parse Verbal Reasoning passage.'
      )
      wizard.setStems([])
    }
  }

  function getStepTitle(currentStep: number): string {
    switch (currentStep) {
      case 0:
        return 'Choose section'
      case 1:
        return 'Paste document'
      case 2:
        return 'Edit question stems'
      case 3:
        return 'Review and submit'
      default:
        return 'Bulk import'
    }
  }

  function handleNextClick() {
    if (!canGoNext) return
    if (step === 1 && isVerbalReasoningSection) {
      // Already parsed via explicit action; if no stems, prevent moving on.
      if (wizard.state.stems.length === 0) return
    }
    setStep((current) => (current < totalSteps - 1 ? current + 1 : current))
  }

  async function handleImportAllVerbalReasoning() {
    if (!sectionId) return
    if (wizard.state.stems.length === 0) {
      setParseError('No parsed stems available to import.')
      return
    }

    try {
      setStatus('submitting')
      setSubmitError(null)
      const stemsToSubmit: UcatQuestionStemFormValues[] = wizard.state.stems.map(
        (stem: BulkImportStemDraft) => stem.values
      )
      await onSubmit({ sectionId, stems: stemsToSubmit })
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to import question stems'
      )
    }
  }

  function renderBody() {
    if (status === 'success') {
      return (
        <div className="py-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mx-auto flex items-center justify-center">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div className="text-lg font-semibold">Bulk import completed</div>
          <div className="text-sm text-muted-foreground">
            All question stems have been created successfully.
          </div>
        </div>
      )
    }

    if (hasErrorMeta) {
      return (
        <div className="py-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto flex items-center justify-center">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <div className="text-lg font-semibold">Failed to load UCAT metadata</div>
          <div className="text-sm text-muted-foreground">
            There was a problem loading sections, categories, or tags. Please close and try again.
          </div>
        </div>
      )
    }

    if (isLoadingMeta) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading UCAT sections and tags…</div>
        </div>
      )
    }

    if (step === 0) {
      return (
        <Step1ChooseSection
          sectionId={sectionId}
          sections={sections}
          onChangeSection={setSectionId}
        />
      )
    }

    if (step === 1) {
      return (
        <>
          <Step2PasteDocument
            value={pastedContent}
            onChange={(value) => {
              setPastedContent(value)
              setParseError(null)
            }}
          />
          {isVerbalReasoningSection && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                This parser is optimised for Verbal Reasoning passages with numbered questions and
                lettered options, like the official UCAT materials.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParseVerbalReasoning}
              >
                Parse Verbal Reasoning
              </Button>
            </div>
          )}
          {parseError && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {parseError}
            </div>
          )}
        </>
      )
    }

    if (step === 2) {
      if (isVerbalReasoningSection) {
        const categoryOptions: CategoryOption[] = categories.map((c) => ({
          id: c.id,
          name: c.name,
          ucat_section_id: c.ucat_section_id,
        }))
        const tagOptions: TagOption[] = tags.map((t) => ({
          id: t.id ?? '',
          name: t.name ?? '',
        }))

        return (
          <Step3EditQuestionStems
            stems={wizard.state.stems}
            activeIndex={wizard.state.activeIndex}
            sections={sections}
            categories={categoryOptions}
            tags={tagOptions}
            selectStem={wizard.selectStem}
            goToNextStem={wizard.goToNextStem}
            goToPreviousStem={wizard.goToPreviousStem}
            updateStemForm={wizard.updateStemForm}
          />
        )
      }

      return (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Edit question stem</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the standard UCAT question stem editor to define the stem, question, and answer
            options you want to import.
          </p>
          <UcatQuestionStemDialog
            open
            title="Create Question Stem"
            submitLabel="Create"
            onClose={() => {}}
            onSubmit={async (values) => {
              try {
                setStatus('submitting')
                setSubmitError(null)
                await onSubmit({ sectionId: values.sectionId, stems: [values] })
                setStatus('success')
                setStep(3)
              } catch (error) {
                setStatus('error')
                setSubmitError(
                  error instanceof Error ? error.message : 'Failed to import question stem'
                )
              }
            }}
            sections={sections.map((section) => ({ id: section.id, name: section.name }))}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              ucat_section_id: c.ucat_section_id,
            }))}
            tags={tags.map((t) => ({ id: t.id ?? '', name: t.name ?? '' }))}
            loading={status === 'submitting'}
          />
        </div>
      )
    }

    if (isVerbalReasoningSection) {
      return (
        <Step4ReviewAndSubmit
          stems={wizard.state.stems}
          activeIndex={wizard.state.activeIndex}
          selectStem={wizard.selectStem}
        />
      )
    }

    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Review and finish</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your question stem has been created. You can close this wizard now and see it in the UCAT
          questions table.
        </p>
      </div>
    )
  }

  const description =
    status === 'success'
      ? 'Review completion details for this import.'
      : `Step ${step + 1} of ${totalSteps}: ${getStepTitle(step)}`

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleRequestClose() : undefined)}>
      <DialogContent className="w-full md:max-w-5xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRequestClose}
                  className="shrink-0"
                  disabled={status === 'submitting'}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Bulk import UCAT question stems</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Progress Indicator */}
          {status !== 'success' && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      index < step
                        ? 'bg-primary'
                        : index === step
                          ? 'bg-primary/50'
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              {renderBody()}
              {status === 'error' && submitError && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t bg-background">
          <>
            <Button
              variant="outline"
              onClick={() => canGoPrevious && setStep((current) => Math.max(0, current - 1))}
              disabled={!canGoPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {status === 'success' ? (
              <Button onClick={handleRequestClose}>Close</Button>
            ) : step < totalSteps - 1 ? (
              <Button onClick={handleNextClick} disabled={!canGoNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : isVerbalReasoningSection ? (
              <Button onClick={handleImportAllVerbalReasoning} disabled={status === 'submitting'}>
                Import all stems
              </Button>
            ) : (
              <Button onClick={handleRequestClose}>Close</Button>
            )}
          </>
        </div>
      </DialogContent>
    </Dialog>
  )
}

