'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  RichTextEditor,
  FormAnswerer,
  Badge,
  Separator,
} from '@altitutor/ui';
import type {
  FormAccessType,
  FormBlock,
  FormContentBlock,
  FormQuestion,
  FormSubmissionLimit,
} from '@altitutor/shared';
import {
  FORM_PURPOSE_OPTIONS,
  createDefaultContentBlock,
  createDefaultQuestion,
  createId,
} from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';
import { ArrowDown, ArrowUp, Copy, Plus, Save, Send, Trash2 } from 'lucide-react';
import type { AdminFormRow, AdminFormTokenRow, AdminFormVersionRow } from '../types';

const BLOCK_TYPES = [
  { value: 'content', label: 'Text block' },
  { value: 'single_choice', label: 'Multiple choice' },
  { value: 'multi_select', label: 'Multi select' },
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
] as const;

function questionTypeLabel(type: FormBlock['type']) {
  return BLOCK_TYPES.find((item) => item.value === type)?.label ?? type;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

export function FormsSettingsPage() {
  const [forms, setForms] = useState<AdminFormRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminFormRow | null>(null);
  const [versions, setVersions] = useState<AdminFormVersionRow[]>([]);
  const [tokens, setTokens] = useState<AdminFormTokenRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedToken, setPublishedToken] = useState<string | null>(null);

  const loadForms = async () => {
    const data = await fetchJson<{ forms: AdminFormRow[] }>('/api/forms');
    setForms(data.forms);
    if (!selectedId && data.forms[0]) setSelectedId(data.forms[0].id);
  };

  const loadSelected = async (id: string) => {
    const data = await fetchJson<{
      form: AdminFormRow;
      versions: AdminFormVersionRow[];
      tokens: AdminFormTokenRow[];
    }>(`/api/forms/${id}`);
    setSelected(data.form);
    setVersions(data.versions);
    setTokens(data.tokens);
  };

  useEffect(() => {
    void loadForms().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedId) void loadSelected(selectedId).catch((err) => setError(err.message));
  }, [selectedId]);

  const updateSelected = (patch: Partial<AdminFormRow>) => {
    setSelected((current) => (current ? { ...current, ...patch } : current));
  };

  const updateBlock = (index: number, block: FormBlock) => {
    if (!selected) return;
    const next = [...selected.draft_blocks];
    next[index] = block;
    updateSelected({ draft_blocks: next });
  };

  const addBlock = (type: FormBlock['type']) => {
    if (!selected) return;
    const block = type === 'content' ? createDefaultContentBlock() : createDefaultQuestion(type as FormQuestion['type']);
    updateSelected({ draft_blocks: [...selected.draft_blocks, block] });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const data = await fetchJson<{ form: AdminFormRow }>(`/api/forms/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: selected.name,
          purpose: selected.purpose,
          accessType: selected.access_type,
          submissionLimit: selected.submission_limit,
          blocks: selected.draft_blocks,
          thankYouMessage: selected.draft_thank_you_message,
        }),
      });
      setSelected(data.form);
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!selected) return;
    setPublishing(true);
    setError(null);
    setPublishedToken(null);
    try {
      await save();
      const data = await fetchJson<{ token: AdminFormTokenRow & { token: string } }>(
        `/api/forms/${selected.id}/publish`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setPublishedToken(data.token.token);
      await loadSelected(selected.id);
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const createForm = async () => {
    setError(null);
    const data = await fetchJson<{ form: AdminFormRow }>('/api/forms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Untitled form' }),
    });
    await loadForms();
    setSelectedId(data.form.id);
  };

  const latestTokenUrl = useMemo(() => {
    const token = publishedToken;
    if (!token) return null;
    return `/form/${token}`;
  }, [publishedToken]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground">Create form definitions and publish answer links.</p>
        </div>
        <Button onClick={createForm}>
          <Plus className="mr-2 h-4 w-4" />
          New form
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {forms.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => setSelectedId(form.id)}
              className={`w-full rounded-md border p-3 text-left hover:bg-muted ${
                selectedId === form.id ? 'border-primary bg-muted' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{form.name}</div>
                <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>{form.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {form.purpose} · {form.response_count ?? 0} responses
              </div>
            </button>
          ))}
        </aside>

        {selected ? (
          <main className="space-y-8">
            <section className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Select value={selected.purpose} onValueChange={(purpose) => updateSelected({ purpose })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_PURPOSE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access</Label>
                  <Select
                    value={selected.access_type}
                    onValueChange={(access_type) => updateSelected({ access_type: access_type as FormAccessType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public_link">Public link</SelectItem>
                      <SelectItem value="authenticated">Authenticated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Submission limit</Label>
                  <Select
                    value={selected.submission_limit}
                    onValueChange={(submission_limit) =>
                      updateSelected({ submission_limit: submission_limit as FormSubmissionLimit })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                      <SelectItem value="one_per_token">One per token</SelectItem>
                      <SelectItem value="one_per_authenticated_respondent">One per authenticated respondent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Thank-you message</Label>
                <Textarea
                  value={selected.draft_thank_you_message}
                  onChange={(event) => updateSelected({ draft_thank_you_message: event.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save draft'}
                </Button>
                <Button onClick={publish} disabled={publishing}>
                  <Send className="mr-2 h-4 w-4" />
                  {publishing ? 'Publishing...' : 'Publish'}
                </Button>
              </div>
              {latestTokenUrl ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="font-medium">Published link:</span>
                  <code>{latestTokenUrl}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}${latestTokenUrl}`)}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              ) : null}
              {tokens.length ? (
                <div className="text-xs text-muted-foreground">
                  Latest published version: {versions[0]?.version_number ?? 'none'} · Existing tokens: {tokens.length}
                </div>
              ) : null}
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Blocks</h2>
                <div className="flex flex-wrap gap-2">
                  {BLOCK_TYPES.map((type) => (
                    <Button key={type.value} variant="outline" size="sm" onClick={() => addBlock(type.value)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {selected.draft_blocks.map((block, index) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={index}
                    onChange={(next) => updateBlock(index, next)}
                    onMove={(direction) => {
                      const next = [...selected.draft_blocks];
                      const target = index + direction;
                      if (target < 0 || target >= next.length) return;
                      [next[index], next[target]] = [next[target], next[index]];
                      updateSelected({ draft_blocks: next });
                    }}
                    onDelete={() => {
                      updateSelected({ draft_blocks: selected.draft_blocks.filter((_, i) => i !== index) });
                    }}
                  />
                ))}
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="mb-4 text-xl font-semibold">Preview</h2>
              <div className="rounded-md border">
                <FormAnswerer
                  title={selected.name}
                  blocks={selected.draft_blocks}
                  thankYouMessage={selected.draft_thank_you_message}
                  onSubmit={() => undefined}
                />
              </div>
            </section>
          </main>
        ) : (
          <main className="rounded-md border p-8 text-center text-muted-foreground">Create a form to get started.</main>
        )}
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  index,
  onChange,
  onMove,
  onDelete,
}: {
  block: FormBlock;
  index: number;
  onChange: (block: FormBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Block {index + 1}</div>
          <div className="text-xs text-muted-foreground">{questionTypeLabel(block.type)}</div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => onMove(-1)} type="button">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onMove(1)} type="button">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onDelete} type="button">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {block.type === 'content' ? (
        <ContentBlockEditor block={block} onChange={onChange} />
      ) : (
        <QuestionEditor block={block} onChange={onChange} />
      )}
    </div>
  );
}

function ContentBlockEditor({
  block,
  onChange,
}: {
  block: FormContentBlock;
  onChange: (block: FormBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Heading</Label>
        <Input value={block.title ?? ''} onChange={(event) => onChange({ ...block, title: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Body</Label>
        <RichTextEditor
          content={block.body as JSONContent}
          onChange={(body) => onChange({ ...block, body: body as Record<string, unknown> })}
          minHeight="120px"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Buttons</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...block,
                buttons: [
                  ...(block.buttons ?? []),
                  { id: createId('button'), label: 'Open link', href: 'https://', style: 'secondary' },
                ],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add button
          </Button>
        </div>
        {(block.buttons ?? []).map((button, index) => (
          <div key={button.id} className="grid gap-2 md:grid-cols-[1fr_1.5fr_130px_auto]">
            <Input
              value={button.label}
              placeholder="Label"
              onChange={(event) => {
                const buttons = [...(block.buttons ?? [])];
                buttons[index] = { ...button, label: event.target.value };
                onChange({ ...block, buttons });
              }}
            />
            <Input
              value={button.href}
              placeholder="https://..."
              onChange={(event) => {
                const buttons = [...(block.buttons ?? [])];
                buttons[index] = { ...button, href: event.target.value };
                onChange({ ...block, buttons });
              }}
            />
            <Select
              value={button.style}
              onValueChange={(style) => {
                const buttons = [...(block.buttons ?? [])];
                buttons[index] = { ...button, style: style === 'primary' ? 'primary' : 'secondary' };
                onChange({ ...block, buttons });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange({ ...block, buttons: (block.buttons ?? []).filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  block,
  onChange,
}: {
  block: FormQuestion;
  onChange: (block: FormBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Question</Label>
          <Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={block.required}
            onChange={(event) => onChange({ ...block, required: event.target.checked })}
          />
          Required
        </label>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={block.description ?? ''}
          onChange={(event) => onChange({ ...block, description: event.target.value })}
        />
      </div>
      {(block.type === 'single_choice' || block.type === 'multi_select') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const n = block.options.length + 1;
                onChange({
                  ...block,
                  options: [...block.options, { id: createId('option'), label: `Option ${n}`, value: `option_${n}` }],
                });
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add option
            </Button>
          </div>
          {block.options.map((option, index) => (
            <div key={option.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={option.label}
                onChange={(event) => {
                  const options = [...block.options];
                  options[index] = { ...option, label: event.target.value };
                  onChange({ ...block, options });
                }}
              />
              <Input
                value={option.value}
                onChange={(event) => {
                  const options = [...block.options];
                  options[index] = { ...option, value: event.target.value };
                  onChange({ ...block, options });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onChange({ ...block, options: block.options.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {(block.type === 'short_text' || block.type === 'long_text') && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Min length</Label>
            <Input
              type="number"
              value={block.minLength ?? ''}
              onChange={(event) =>
                onChange({ ...block, minLength: event.target.value === '' ? undefined : Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Max length</Label>
            <Input
              type="number"
              value={block.maxLength ?? ''}
              onChange={(event) =>
                onChange({ ...block, maxLength: event.target.value === '' ? undefined : Number(event.target.value) })
              }
            />
          </div>
        </div>
      )}
      {block.type === 'number' && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Display</Label>
            <Select
              value={block.display}
              onValueChange={(display) =>
                onChange({
                  ...block,
                  display: display === 'slider' || display === 'rating' ? display : 'input',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="input">Input</SelectItem>
                <SelectItem value="slider">Slider</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(['min', 'max', 'step'] as const).map((field) => (
            <div key={field} className="space-y-2">
              <Label>{field}</Label>
              <Input
                type="number"
                value={block[field] ?? ''}
                onChange={(event) =>
                  onChange({ ...block, [field]: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
