'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Json } from '@altitutor/shared'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import {
  useDeleteUcatLearningModule,
  useReplaceUcatLearningModuleBlocks,
  useUcatLearningModule,
  useUcatLearningModuleBlocks,
  useUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import { useUcatSections, useUcatStemCatalog } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatSkillTrainerSets } from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'
import type {
  UcatLearningModuleBlockPayload,
  UcatLearningModuleBlockType,
  UcatLearningModuleDisplayMode,
  UcatLearningModuleKind,
} from '@/features/ucat/learning-modules/types'

type DraftBlock = {
  clientId: string
  block_type: UcatLearningModuleBlockType
  require_completion_before_next: boolean
  content: Record<string, unknown>
  question_stem_id: string | null
  question_id: string | null
  file_id: string | null
  skill_trainer_set_id: string | null
}

const BLOCK_TYPE_LABELS: Record<UcatLearningModuleBlockType, string> = {
  text: 'Text',
  video: 'Video',
  file: 'File',
  question_stem: 'Question stem',
  question: 'Question',
  skill_trainer_set: 'Skill trainer set',
}

function newDraftBlock(type: UcatLearningModuleBlockType = 'text'): DraftBlock {
  return {
    clientId: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    block_type: type,
    require_completion_before_next: true,
    content: type === 'text' ? { body: plainTextToProseMirror('') } : type === 'video' ? { url: '' } : {},
    question_stem_id: null,
    question_id: null,
    file_id: null,
    skill_trainer_set_id: null,
  }
}

function toPayload(blocks: DraftBlock[]): UcatLearningModuleBlockPayload[] {
  return blocks.map((b, index) => ({
    block_type: b.block_type,
    index,
    require_completion_before_next: b.require_completion_before_next,
    content: b.content,
    question_stem_id: b.question_stem_id,
    question_id: b.question_id,
    file_id: b.file_id,
    skill_trainer_set_id: b.skill_trainer_set_id,
  }))
}

export function UcatLearningModuleDetailPage({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)

  const moduleQuery = useUcatLearningModule(moduleId)
  const blocksQuery = useUcatLearningModuleBlocks(moduleId)
  const { data: allModules } = useUcatLearningModules()
  const { data: sections } = useUcatSections()
  const stemCatalog = useUcatStemCatalog(hasUcatAccess)
  const { data: skillTrainerSets } = useUcatSkillTrainerSets()

  const upsert = useUpsertUcatLearningModule()
  const replaceBlocks = useReplaceUcatLearningModuleBlocks()
  const deleteModule = useDeleteUcatLearningModule()

  const [kind, setKind] = useState<UcatLearningModuleKind>('lesson')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [index, setIndex] = useState('0')
  const [isPrivate, setIsPrivate] = useState(true)
  const [displayMode, setDisplayMode] = useState<UcatLearningModuleDisplayMode>('stepped')
  const [draftBlocks, setDraftBlocks] = useState<DraftBlock[]>([])
  const [settingsBaseline, setSettingsBaseline] = useState('')
  const [blocksBaseline, setBlocksBaseline] = useState('')

  const folderOptions = useMemo(
    () => (allModules ?? []).filter((m) => m.kind === 'folder' && m.id !== moduleId),
    [allModules, moduleId]
  )

  const stemOptions = useMemo(() => stemCatalog.data ?? [], [stemCatalog.data])

  useEffect(() => {
    const m = moduleQuery.data
    if (!m) return
    setKind(m.kind)
    setTitle(m.title)
    setDescription(m.description ?? '')
    setSectionId(m.ucat_section_id)
    setParentId(m.parent_ucat_learning_module_id)
    setIndex(String(m.index))
    setIsPrivate(m.is_private)
    setDisplayMode(m.display_mode ?? 'stepped')
    setSettingsBaseline(
      JSON.stringify({
        kind: m.kind,
        title: m.title,
        description: m.description ?? '',
        sectionId: m.ucat_section_id,
        parentId: m.parent_ucat_learning_module_id,
        index: m.index,
        isPrivate: m.is_private,
        displayMode: m.display_mode ?? 'stepped',
      })
    )
  }, [moduleQuery.data])

  useEffect(() => {
    const rows = blocksQuery.data ?? []
    const draft = rows.map((row) => ({
      clientId: row.id,
      block_type: row.block_type,
      require_completion_before_next: row.require_completion_before_next,
      content: (row.content ?? {}) as Record<string, unknown>,
      question_stem_id: row.question_stem_id,
      question_id: row.question_id,
      file_id: row.file_id,
      skill_trainer_set_id: row.skill_trainer_set_id,
    }))
    setDraftBlocks(draft)
    setBlocksBaseline(JSON.stringify(toPayload(draft)))
  }, [blocksQuery.data])

  const settingsDirty = useMemo(() => {
    const current = JSON.stringify({
      kind,
      title,
      description,
      sectionId,
      parentId,
      index: Number(index) || 0,
      isPrivate,
      displayMode,
    })
    return current !== settingsBaseline
  }, [kind, title, description, sectionId, parentId, index, isPrivate, displayMode, settingsBaseline])

  const blocksDirty = useMemo(() => {
    return JSON.stringify(toPayload(draftBlocks)) !== blocksBaseline
  }, [draftBlocks, blocksBaseline])

  const updateBlock = useCallback((clientId: string, patch: Partial<DraftBlock>) => {
    setDraftBlocks((prev) => prev.map((b) => (b.clientId === clientId ? { ...b, ...patch } : b)))
  }, [])

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= draftBlocks.length) return
    setDraftBlocks((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const handleSaveSettings = async () => {
    if (!title.trim()) return
    try {
      await upsert.mutateAsync({
        moduleId,
        kind,
        title: title.trim(),
        description: description.trim() || null,
        ucatSectionId: sectionId,
        parentId,
        index: Number(index) || 0,
        isPrivate,
        displayMode: kind === 'lesson' ? displayMode : undefined,
      })
      setSettingsBaseline(
        JSON.stringify({
          kind,
          title: title.trim(),
          description: description.trim(),
          sectionId,
          parentId,
          index: Number(index) || 0,
          isPrivate,
          displayMode,
        })
      )
      toast({ title: 'Settings saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  const handleSaveBlocks = async () => {
    try {
      await replaceBlocks.mutateAsync({ moduleId, blocks: toPayload(draftBlocks) })
      setBlocksBaseline(JSON.stringify(toPayload(draftBlocks)))
      toast({ title: 'Blocks saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this learning module? This cannot be undone.')) return
    try {
      await deleteModule.mutateAsync(moduleId)
      router.push('/ucat/learning-modules')
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' })
    }
  }

  if (access.isLoading || moduleQuery.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />
  if (!moduleQuery.data) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Module not found.</p>
        <Button type="button" variant="link" asChild className="px-0">
          <Link href="/ucat/learning-modules">Back to list</Link>
        </Button>
      </TutorPageContainer>
    )
  }

  return (
    <TutorPageContainer>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UcatPageHeader
            title={title || 'Learning module'}
            description="Configure module settings and lesson blocks."
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/ucat/learning-modules">Back</Link>
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteModule.isPending}>
              Delete
            </Button>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as UcatLearningModuleKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="folder">Folder</SelectItem>
                  <SelectItem value="lesson">Lesson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>UCAT section</Label>
              <Select
                value={sectionId ?? 'none'}
                onValueChange={(v) => setSectionId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(sections ?? [])
                    .filter((s): s is typeof s & { id: string } => s.id != null)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.section_number}. {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent folder</Label>
              <Select value={parentId ?? 'none'} onValueChange={(v) => setParentId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Root" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Root (no parent)</SelectItem>
                  {folderOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort index</Label>
              <Input type="number" min={0} value={index} onChange={(e) => setIndex(e.target.value)} />
            </div>
            {kind === 'lesson' ? (
              <div className="space-y-2">
                <Label>Display mode</Label>
                <Select
                  value={displayMode}
                  onValueChange={(v) => setDisplayMode(v as UcatLearningModuleDisplayMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scroll">Scroll</SelectItem>
                    <SelectItem value="stepped">Stepped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} id="module-private" />
              <Label htmlFor="module-private">Private (class-only until published)</Label>
            </div>
          </div>
          <Button type="button" onClick={handleSaveSettings} disabled={!settingsDirty || upsert.isPending}>
            {upsert.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </section>

        {kind === 'lesson' ? (
          <section className="space-y-4 rounded-2xl border p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Lesson blocks</h2>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BLOCK_TYPE_LABELS) as UcatLearningModuleBlockType[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraftBlocks((prev) => [...prev, newDraftBlock(type)])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {BLOCK_TYPE_LABELS[type]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {draftBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocks yet. Add one above.</p>
              ) : null}
              {draftBlocks.map((block, idx) => (
                <div key={block.clientId} className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {idx + 1}. {BLOCK_TYPE_LABELS[block.block_type]}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={idx === 0}
                        onClick={() => moveBlock(idx, idx - 1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={idx === draftBlocks.length - 1}
                        onClick={() => moveBlock(idx, idx + 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setDraftBlocks((prev) => prev.filter((b) => b.clientId !== block.clientId))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={block.require_completion_before_next}
                      onCheckedChange={(checked) =>
                        updateBlock(block.clientId, { require_completion_before_next: checked })
                      }
                      id={`req-${block.clientId}`}
                    />
                    <Label htmlFor={`req-${block.clientId}`}>Require completion before next</Label>
                  </div>

                  {block.block_type === 'text' ? (
                    <UcatRichTextEditor
                      value={(block.content.body as Json) ?? plainTextToProseMirror('')}
                      onChange={(body) => updateBlock(block.clientId, { content: { body } })}
                    />
                  ) : null}

                  {block.block_type === 'video' ? (
                    <div className="space-y-2">
                      <Label>Video URL</Label>
                      <Input
                        value={String(block.content.url ?? '')}
                        onChange={(e) => updateBlock(block.clientId, { content: { url: e.target.value } })}
                        placeholder="https://…"
                      />
                    </div>
                  ) : null}

                  {block.block_type === 'file' ? (
                    <div className="space-y-2">
                      <Label>File ID</Label>
                      <Input
                        value={block.file_id ?? ''}
                        onChange={(e) => updateBlock(block.clientId, { file_id: e.target.value || null })}
                        placeholder="UUID from files table"
                      />
                    </div>
                  ) : null}

                  {block.block_type === 'question_stem' ? (
                    <div className="space-y-2">
                      <Label>Question stem</Label>
                      <Select
                        value={block.question_stem_id ?? 'none'}
                        onValueChange={(v) =>
                          updateBlock(block.clientId, { question_stem_id: v === 'none' ? null : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select stem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {stemOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.text.length > 60 ? `${s.text.slice(0, 57)}…` : s.text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {block.block_type === 'question' ? (
                    <div className="space-y-2">
                      <Label>Question ID</Label>
                      <Input
                        value={block.question_id ?? ''}
                        onChange={(e) => updateBlock(block.clientId, { question_id: e.target.value || null })}
                        placeholder="UUID from ucat_questions"
                      />
                    </div>
                  ) : null}

                  {block.block_type === 'skill_trainer_set' ? (
                    <div className="space-y-2">
                      <Label>Skill trainer set</Label>
                      <Select
                        value={block.skill_trainer_set_id ?? 'none'}
                        onValueChange={(v) =>
                          updateBlock(block.clientId, { skill_trainer_set_id: v === 'none' ? null : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select set" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(skillTrainerSets ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.trainer_name}: {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Button type="button" onClick={handleSaveBlocks} disabled={!blocksDirty || replaceBlocks.isPending}>
              {replaceBlocks.isPending ? 'Saving…' : 'Save blocks'}
            </Button>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Folders group lessons. Add child lessons by setting their parent folder to this module.
          </p>
        )}
      </div>
    </TutorPageContainer>
  )
}
