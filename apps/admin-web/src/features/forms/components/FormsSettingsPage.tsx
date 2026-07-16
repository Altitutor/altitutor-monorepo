'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  FormAnswerer,
  Input,
  Label,
  RichTextEditor,
  SearchableSelect,
  SegmentedControl,
  Separator,
  Switch,
  Textarea,
} from '@altitutor/ui';
import type {
  FormAccessType,
  FormBlock,
  FormButtonStyle,
  FormContentBlock,
  FormQuestion,
  FormChoiceOption,
  FormModelOptionSource,
  FormSubmissionLimit,
} from '@altitutor/shared';
import {
  FORM_PURPOSE_OPTIONS,
  FORM_MODEL_OPTION_SOURCE_OPTIONS,
  FORM_WORKFLOW_KEY_OPTIONS,
  createDefaultContentBlock,
  createDefaultQuestion,
  createId,
  getChangedFormQuestionIds,
  getFormModelOptionSources,
  hydrateFormModelOptions,
} from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';
import { ArrowDown, ArrowUp, Copy, FileDown, Plus, Send, Trash2 } from 'lucide-react';
import {
  AdminDialogShell,
  AdminPageActionButton,
  SettingsDataTable,
  SettingsPageHeader,
  type SettingsDataTableColumn,
} from '@/shared/components';
import type { AdminFormRow, AdminFormTokenRow, AdminFormVersionRow } from '../types';

const NEW_FORM_ID = '__new__';

function createBlankForm(): AdminFormRow {
  const now = new Date().toISOString();
  return {
    id: NEW_FORM_ID,
    name: 'Untitled form',
    purpose: 'other',
    workflow_key: null,
    workflow_request_expiry_days: null,
    status: 'draft',
    access_type: 'public_link',
    submission_limit: 'unlimited',
    draft_blocks: [createDefaultContentBlock()],
    draft_thank_you_message: 'Thanks for your response.',
    latest_published_version_id: null,
    created_at: now,
    updated_at: now,
    response_count: 0,
  };
}

const BLOCK_TYPES = [
  { value: 'content', label: 'Text block' },
  { value: 'single_choice', label: 'Multiple choice' },
  { value: 'multi_select', label: 'Multi select' },
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
] as const satisfies Array<{ value: FormBlock['type']; label: string }>;

const ACCESS_OPTIONS = [
  { value: 'public_link', label: 'Public link' },
  { value: 'authenticated', label: 'Authenticated' },
] as const satisfies Array<{ value: FormAccessType; label: string }>;

const SUBMISSION_LIMIT_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'one_per_token', label: 'One per token' },
  { value: 'one_per_authenticated_respondent', label: 'One per authenticated respondent' },
] as const satisfies Array<{ value: FormSubmissionLimit; label: string }>;

const BUTTON_STYLE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
] as const satisfies Array<{ value: FormButtonStyle; label: string }>;

type NumberDisplay = Extract<FormQuestion, { type: 'number' }>['display'];

const NUMBER_DISPLAY_OPTIONS = [
  { value: 'input', label: 'Input' },
  { value: 'slider', label: 'Slider' },
  { value: 'rating', label: 'Rating' },
] as const satisfies Array<{ value: NumberDisplay; label: string }>;

const CHOICE_SOURCE_OPTIONS = [
  { value: 'static', label: 'Custom options' },
  ...FORM_MODEL_OPTION_SOURCE_OPTIONS,
] as const;

type FormDialogTab = 'properties' | 'questions' | 'preview';
type FormAudience = 'student' | 'tutor';
type FormLinks = Record<FormAudience, string>;
type FormSaveIntent = 'save' | 'publish';

function questionTypeLabel(type: FormBlock['type']) {
  return BLOCK_TYPES.find((item) => item.value === type)?.label ?? type;
}

function purposeLabel(value: string) {
  return FORM_PURPOSE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function accessLabel(value: FormAccessType) {
  return ACCESS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(value));
}

function formUrl(audience: FormAudience, token: string) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = audience === 'student'
    ? (isDevelopment ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com'))
    : (isDevelopment ? 'http://localhost:3002' : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com'));
  return `${baseUrl.replace(/\/$/, '')}/form/${token}`;
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

function OptionSelect<T extends { value: string; label: string }>({
  items,
  value,
  onValueChange,
  placeholder = 'Select...',
}: {
  items: readonly T[];
  value: string;
  onValueChange: (value: T['value']) => void;
  placeholder?: string;
}) {
  const selected = items.find((item) => item.value === value) ?? null;
  return (
    <SearchableSelect<T>
      items={[...items]}
      value={selected}
      onValueChange={(item) => {
        if (item) onValueChange(item.value);
      }}
      getItemId={(item) => item.value}
      getItemLabel={(item) => item.label}
      placeholder={placeholder}
      trigger={
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          {selected?.label ?? placeholder}
        </Button>
      }
    />
  );
}

export function FormsSettingsPage() {
  const [forms, setForms] = useState<AdminFormRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminFormRow | null>(null);
  const [versions, setVersions] = useState<AdminFormVersionRow[]>([]);
  const [tokens, setTokens] = useState<AdminFormTokenRow[]>([]);
  const [activeTab, setActiveTab] = useState<FormDialogTab>('properties');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingSaveIntent, setPendingSaveIntent] = useState<FormSaveIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formLinks, setFormLinks] = useState<Record<string, FormLinks>>({});
  const isCreating = editingId === NEW_FORM_ID;

  const loadForms = async () => {
    const data = await fetchJson<{ forms: AdminFormRow[] }>('/api/forms');
    setForms(data.forms);
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
    setLoading(true);
    void loadForms()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load forms'))
      .finally(() => setLoading(false));
  }, []);

  const openForm = async (id: string) => {
    setError(null);
    setActiveTab('properties');
    setEditingId(id);
    await loadSelected(id).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load form'));
  };

  const closeDialog = () => {
    setEditingId(null);
    setSelected(null);
    setVersions([]);
    setTokens([]);
    setDeleteConfirmOpen(false);
    setPendingSaveIntent(null);
    setActiveTab('properties');
  };

  const openNewForm = () => {
    setError(null);
    setActiveTab('properties');
    setVersions([]);
    setTokens([]);
    setEditingId(NEW_FORM_ID);
    setSelected(createBlankForm());
  };

  const updateSelected = (patch: Partial<AdminFormRow>) => {
    setSelected((current) => (current ? { ...current, ...patch } : current));
  };

  const updateBlock = (index: number, block: FormBlock) => {
    if (!selected) return;
    const next = [...selected.draft_blocks];
    next[index] = block;
    updateSelected({ draft_blocks: next });
  };

  const formPayload = (form: AdminFormRow) => ({
    name: form.name,
    purpose: form.purpose,
    workflowKey: form.workflow_key,
    workflowRequestExpiryDays: form.workflow_request_expiry_days,
    accessType: form.access_type,
    submissionLimit: form.submission_limit,
    blocks: form.draft_blocks,
    thankYouMessage: form.draft_thank_you_message,
  });

  const createForm = async () => {
    if (!selected) return null;
    setSaving(true);
    setError(null);
    try {
      const data = await fetchJson<{ form: AdminFormRow }>('/api/forms', {
        method: 'POST',
        body: JSON.stringify(formPayload(selected)),
      });
      setSelected(data.form);
      setEditingId(data.form.id);
      await loadForms();
      return data.form;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!selected || isCreating) return null;
    setSaving(true);
    setError(null);
    try {
      const data = await fetchJson<{ form: AdminFormRow }>(`/api/forms/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formPayload(selected)),
      });
      setSelected(data.form);
      await loadForms();
      return data.form;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const changedPublishedQuestionIds = useMemo(() => {
    if (!selected?.latest_published_version_id) return [];
    const latestVersion = versions.find((version) => version.id === selected.latest_published_version_id);
    if (!latestVersion) return [];
    return getChangedFormQuestionIds(latestVersion.blocks, selected.draft_blocks);
  }, [selected, versions]);

  const requestSave = (intent: FormSaveIntent) => {
    if (changedPublishedQuestionIds.length) {
      setPendingSaveIntent(intent);
      return;
    }
    if (intent === 'publish') void publish();
    else void save();
  };

  const deleteForm = async () => {
    if (!selected || isCreating) return;
    setDeleting(true);
    setError(null);
    try {
      await fetchJson<{ form: AdminFormRow }>(`/api/forms/${selected.id}`, { method: 'DELETE' });
      setDeleteConfirmOpen(false);
      closeDialog();
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const publish = async () => {
    if (!selected || isCreating) return;
    setPublishing(true);
    setError(null);
    try {
      const saved = await save();
      if (!saved) return;
      const data = await fetchJson<{ token: string }>(
        `/api/forms/${saved.id}/publish`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (!data.token) throw new Error('Could not create a published form link.');
      setFormLinks((current) => ({
        ...current,
        [saved.id]: {
          student: formUrl('student', data.token),
          tutor: formUrl('tutor', data.token),
        },
      }));
      await loadSelected(saved.id);
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const columns: SettingsDataTableColumn<AdminFormRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        render: (form) => <span className="font-medium">{form.name}</span>,
        sortValue: (form) => form.name,
        searchValue: (form) => form.name,
      },
      {
        key: 'status',
        label: 'Status',
        render: (form) => <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>{form.status}</Badge>,
        sortValue: (form) => form.status,
        filterValue: (form) => form.status,
      },
      {
        key: 'purpose',
        label: 'Purpose',
        render: (form) => <span>{purposeLabel(form.purpose)}</span>,
        sortValue: (form) => purposeLabel(form.purpose),
        filterValue: (form) => form.purpose,
        searchValue: (form) => purposeLabel(form.purpose),
      },
      {
        key: 'access',
        label: 'Access',
        render: (form) => <span>{accessLabel(form.access_type)}</span>,
        sortValue: (form) => accessLabel(form.access_type),
        filterValue: (form) => form.access_type,
      },
      {
        key: 'responses',
        label: 'Responses',
        render: (form) => <span className="tabular-nums">{form.response_count ?? 0}</span>,
        sortValue: (form) => form.response_count ?? 0,
      },
      {
        key: 'updated',
        label: 'Updated',
        render: (form) => <span>{formatDate(form.updated_at)}</span>,
        sortValue: (form) => new Date(form.updated_at),
      },
    ],
    [],
  );

  const copyFormLink = async (form: AdminFormRow, audience: FormAudience) => {
    let link = formLinks[form.id]?.[audience];
    if (!link) {
      const data = await fetchJson<{ token: string }>(`/api/forms/${form.id}/share-link`, { method: 'POST' });
      const token = data.token;
      if (!token) throw new Error('Could not create a form link.');
      setFormLinks((current) => ({
        ...current,
        [form.id]: {
          student: current[form.id]?.student ?? formUrl('student', token),
          tutor: current[form.id]?.tutor ?? formUrl('tutor', token),
        },
      }));
      link = formUrl(audience, token);
    }
    await navigator.clipboard.writeText(link);
  };

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Forms"
        actions={
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New form"
            onClick={openNewForm}
          />
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <SettingsDataTable
        data={forms}
        columns={columns}
        getRowId={(form) => form.id}
        isLoading={loading}
        emptyMessage="No forms configured"
        searchPlaceholder="Search forms..."
        filterKeys={['status', 'purpose', 'access']}
        filterDefinitions={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Published', value: 'published' },
              { label: 'Archived', value: 'archived' },
            ],
          },
          {
            key: 'purpose',
            label: 'Purpose',
            options: FORM_PURPOSE_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
          },
          {
            key: 'access',
            label: 'Access',
            options: ACCESS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
          },
        ]}
        defaultSort={{ field: 'updated', direction: 'desc' }}
        getActions={(form) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => void openForm(form.id),
          },
          {
            id: 'copy-student-link',
            label: 'Copy student link',
            description: 'Copy a link that opens in student-web',
            disabled: !form.latest_published_version_id,
            icon: Copy,
            onSelect: () => void copyFormLink(form, 'student'),
          },
          {
            id: 'copy-tutor-link',
            label: 'Copy tutor link',
            description: 'Copy a link that opens in tutor-web',
            disabled: !form.latest_published_version_id,
            icon: Copy,
            onSelect: () => void copyFormLink(form, 'tutor'),
          },
          {
            id: 'download-pdf',
            label: 'Download PDF',
            description: form.latest_published_version_id ? 'Download the latest published version' : 'Publish this form before downloading it',
            disabled: !form.latest_published_version_id,
            icon: FileDown,
            onSelect: () => window.open(`/api/forms/${form.id}/pdf`, '_blank', 'noopener,noreferrer'),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingId}
        onClose={closeDialog}
        title={isCreating ? 'New form' : (selected?.name ?? 'Edit form')}
        subtitle={
          isCreating
            ? 'Configure the form, then create it when you are ready.'
            : 'Edit the draft form, then preview and publish answer links.'
        }
        defaultExpanded
        contentClassName="md:max-w-6xl"
        footer={
          <>
            {!isCreating && selected ? (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting || saving || publishing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={closeDialog}>
              {isCreating ? 'Cancel' : 'Close'}
            </Button>
            {isCreating ? (
              <Button type="button" onClick={() => void createForm()} disabled={!selected || saving}>
                {saving ? 'Creating...' : 'Create'}
              </Button>
            ) : activeTab !== 'preview' ? (
              <>
                <Button type="button" variant="outline" onClick={() => requestSave('save')} disabled={!selected || saving}>
                  {saving ? 'Saving...' : 'Save draft'}
                </Button>
                <Button type="button" onClick={() => requestSave('publish')} disabled={!selected || publishing}>
                  <Send className="mr-2 h-4 w-4" />
                  {publishing ? 'Publishing...' : 'Publish'}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <SegmentedControl
              value={activeTab}
              onValueChange={(value) => {
                if (value === 'questions' || value === 'preview') setActiveTab(value);
                else setActiveTab('properties');
              }}
              options={[
                { value: 'properties', label: 'Properties' },
                { value: 'questions', label: 'Questions' },
                { value: 'preview', label: 'Preview' },
              ]}
            />

            {activeTab === 'properties' ? (
              <FormPropertiesEditor
                selected={selected}
                versions={versions}
                tokens={tokens}
                assignedWorkflows={new Set(
                  forms
                    .filter((form) => form.id !== selected.id)
                    .map((form) => form.workflow_key)
                    .filter((workflow): workflow is NonNullable<typeof workflow> => workflow !== null),
                )}
                publishedLinks={selected ? formLinks[selected.id] ?? null : null}
                onCopyLink={(audience) => void copyFormLink(selected, audience)}
                updateSelected={updateSelected}
              />
            ) : null}

            {activeTab === 'questions' ? (
              <FormQuestionsEditor
                selected={selected}
                updateSelected={updateSelected}
                updateBlock={updateBlock}
              />
            ) : null}

            {activeTab === 'preview' ? (
              <div>
                <FormPreview form={selected} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">Loading form...</div>
        )}
      </AdminDialogShell>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive <span className="font-medium text-foreground">{selected?.name ?? 'this form'}</span> and
              revoke any published links. Existing responses are kept. This action cannot be undone from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteForm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete form'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingSaveIntent !== null}
        onOpenChange={(open) => {
          if (!open && !saving && !publishing) setPendingSaveIntent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Create {changedPublishedQuestionIds.length === 1 ? 'a new reportable question' : 'new reportable questions'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This change alters how {changedPublishedQuestionIds.length === 1 ? 'a question is answered' : 'these questions are answered'}.
              Existing responses will remain under the previous {changedPublishedQuestionIds.length === 1 ? 'question' : 'questions'}, and future responses will be reported separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving || publishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || publishing}
              onClick={(event) => {
                event.preventDefault();
                const intent = pendingSaveIntent;
                setPendingSaveIntent(null);
                if (intent === 'publish') void publish();
                else if (intent === 'save') void save();
              }}
            >
              {pendingSaveIntent === 'publish' ? 'Create and publish' : 'Create and save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormPreview({ form }: { form: AdminFormRow }) {
  const [blocks, setBlocks] = useState(form.draft_blocks);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sources = getFormModelOptionSources(form.draft_blocks);
    if (!sources.length) {
      setBlocks(form.draft_blocks);
      setError(null);
      return;
    }
    let cancelled = false;
    void Promise.all(
      sources.map(async (source) => {
        const data = await fetchJson<{ options: FormChoiceOption[] }>(`/api/forms/model-options?source=${source}`);
        return [source, data.options] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setBlocks(hydrateFormModelOptions(form.draft_blocks, Object.fromEntries(entries)));
          setError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load model options.');
      });
    return () => { cancelled = true; };
  }, [form.draft_blocks]);

  return (
    <div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <FormAnswerer
        title={form.name}
        blocks={blocks}
        thankYouMessage={form.draft_thank_you_message}
        onSubmit={() => undefined}
      />
    </div>
  );
}

function FormPropertiesEditor({
  selected,
  versions,
  tokens,
  assignedWorkflows,
  publishedLinks,
  onCopyLink,
  updateSelected,
}: {
  selected: AdminFormRow;
  versions: AdminFormVersionRow[];
  tokens: AdminFormTokenRow[];
  assignedWorkflows: Set<string>;
  publishedLinks: FormLinks | null;
  onCopyLink: (audience: FormAudience) => void;
  updateSelected: (patch: Partial<AdminFormRow>) => void;
}) {
  return (
    <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <OptionSelect
              items={FORM_PURPOSE_OPTIONS}
              value={selected.purpose}
              onValueChange={(purpose) => updateSelected({ purpose })}
              placeholder="Select purpose"
            />
          </div>
          <div className="space-y-2">
            <Label>Workflow</Label>
            <OptionSelect
              items={[
                { value: '', label: 'Not assigned' },
                ...FORM_WORKFLOW_KEY_OPTIONS.filter(
                  (option) => option.value === selected.workflow_key || !assignedWorkflows.has(option.value),
                ),
              ]}
              value={selected.workflow_key ?? ''}
              onValueChange={(workflow_key) => updateSelected({ workflow_key: workflow_key ? workflow_key as AdminFormRow['workflow_key'] : null })}
              placeholder="Not assigned"
            />
          </div>
          <div className="space-y-2">
            <Label>Workflow link expiry (days)</Label>
            <Input
              type="number"
              min={1}
              placeholder="No expiry"
              value={selected.workflow_request_expiry_days ?? ''}
              onChange={(event) => updateSelected({ workflow_request_expiry_days: event.target.value ? Number(event.target.value) : null })}
              disabled={!selected.workflow_key}
            />
          </div>
          <div className="space-y-2">
            <Label>Access</Label>
            <OptionSelect
              items={ACCESS_OPTIONS}
              value={selected.access_type}
              onValueChange={(access_type) => updateSelected({ access_type: access_type as FormAccessType })}
              placeholder="Select access"
            />
          </div>
          <div className="space-y-2">
            <Label>Submission limit</Label>
            <OptionSelect
              items={SUBMISSION_LIMIT_OPTIONS}
              value={selected.submission_limit}
              onValueChange={(submission_limit) =>
                updateSelected({ submission_limit: submission_limit as FormSubmissionLimit })
              }
              placeholder="Select submission limit"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Thank-you message</Label>
          <Textarea
            value={selected.draft_thank_you_message}
            onChange={(event) => updateSelected({ draft_thank_you_message: event.target.value })}
          />
        </div>
        {selected.latest_published_version_id ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <span className="font-medium">Published links</span>
            {(['student', 'tutor'] as const).map((audience) => (
              <div key={audience} className="flex items-center gap-2">
                <span className="w-14 capitalize text-muted-foreground">{audience}</span>
                <code className="min-w-0 flex-1 truncate">{publishedLinks?.[audience] ?? `Create a ${audience} link to copy it`}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => onCopyLink(audience)}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {tokens.length ? (
          <div className="text-xs text-muted-foreground">
            Latest published version: {versions[0]?.version_number ?? 'none'} · Existing tokens: {tokens.length}
          </div>
        ) : null}
    </div>
  );
}

function FormQuestionsEditor({
  selected,
  updateSelected,
  updateBlock,
}: {
  selected: AdminFormRow;
  updateSelected: (patch: Partial<AdminFormRow>) => void;
  updateBlock: (index: number, block: FormBlock) => void;
}) {
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedBlockId) return;
    const timeout = window.setTimeout(() => setHighlightedBlockId(null), 900);
    return () => window.clearTimeout(timeout);
  }, [highlightedBlockId]);

  const handleInsert = (type: FormBlock['type'], index: number) => {
    const block = type === 'content' ? createDefaultContentBlock() : createDefaultQuestion(type as FormQuestion['type']);
    const next = [...selected.draft_blocks];
    next.splice(index, 0, block);
    updateSelected({ draft_blocks: next });
    setHighlightedBlockId(block.id);
  };

  return (
    <div className="space-y-3">
      <BlockInsertControl onInsert={(type) => handleInsert(type, 0)} label="Add first block" />
      {selected.draft_blocks.map((block, index) => (
        <div key={block.id} className="space-y-3 transition-all duration-200 ease-out animate-in fade-in-0 slide-in-from-top-1">
          <BlockEditor
            block={block}
            index={index}
            highlighted={highlightedBlockId === block.id}
            onChange={(next) => updateBlock(index, next)}
            onMove={(direction) => {
              const next = [...selected.draft_blocks];
              const target = index + direction;
              if (target < 0 || target >= next.length) return;
              [next[index], next[target]] = [next[target], next[index]];
              updateSelected({ draft_blocks: next });
              setHighlightedBlockId(block.id);
            }}
            onDelete={() => {
              if (!window.confirm(`Delete block ${index + 1}? This cannot be undone.`)) return;
              updateSelected({ draft_blocks: selected.draft_blocks.filter((_, i) => i !== index) });
            }}
          />
          <BlockInsertControl onInsert={(type) => handleInsert(type, index + 1)} />
        </div>
      ))}
    </div>
  );
}

function BlockInsertControl({
  onInsert,
  label = 'Add block',
}: {
  onInsert: (type: FormBlock['type']) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Separator className="flex-1" />
      <SearchableSelect<(typeof BLOCK_TYPES)[number]>
        items={[...BLOCK_TYPES]}
        value={null}
        onValueChange={(item) => {
          if (item) onInsert(item.value);
        }}
        getItemId={(item) => item.value}
        getItemLabel={(item) => item.label}
        placeholder={label}
        searchPlaceholder="Search block types..."
        trigger={
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            {label}
          </Button>
        }
      />
      <Separator className="flex-1" />
    </div>
  );
}

function BlockEditor({
  block,
  index,
  highlighted,
  onChange,
  onMove,
  onDelete,
}: {
  block: FormBlock;
  index: number;
  highlighted?: boolean;
  onChange: (block: FormBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={[
        'transition-all duration-300 ease-out',
        highlighted ? 'ring-2 ring-primary/70 bg-primary/5 shadow-sm' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CardContent className="p-4">
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
            <Button variant="destructive" size="icon" onClick={onDelete} type="button">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {block.type === 'content' ? (
          <ContentBlockEditor block={block} onChange={onChange} />
        ) : (
          <QuestionEditor block={block} onChange={onChange} />
        )}
      </CardContent>
    </Card>
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
          <div key={button.id} className="grid gap-2 md:grid-cols-[1fr_1.5fr_160px_auto]">
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
            <OptionSelect
              items={BUTTON_STYLE_OPTIONS}
              value={button.style}
              onValueChange={(style) => {
                const buttons = [...(block.buttons ?? [])];
                buttons[index] = { ...button, style: style as FormButtonStyle };
                onChange({ ...block, buttons });
              }}
              placeholder="Button style"
            />
            <Button
              type="button"
              variant="destructive"
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
  const modelOptionSource =
    (block.type === 'single_choice' || block.type === 'multi_select') && block.optionSource?.kind === 'model'
      ? block.optionSource.source
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Question</Label>
          <Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        </div>
        <div className="flex items-end justify-between gap-3 pb-2">
          <Label className="text-sm">Required</Label>
          <Switch
            checked={block.required}
            onCheckedChange={(required) => onChange({ ...block, required })}
          />
        </div>
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
          <div className="space-y-2">
            <Label>Option source</Label>
            <OptionSelect
              items={CHOICE_SOURCE_OPTIONS}
              value={block.optionSource?.kind === 'model' ? block.optionSource.source : 'static'}
              onValueChange={(source) => {
                if (source === 'static') {
                  onChange({
                    ...block,
                    optionSource: { kind: 'static' },
                    options: block.options.length ? block.options : [
                      { id: createId('option'), label: 'Option 1', value: 'option_1' },
                    ],
                  });
                  return;
                }
                onChange({
                  ...block,
                  optionSource: { kind: 'model', source: source as FormModelOptionSource },
                  options: [],
                });
              }}
              placeholder="Select option source"
            />
          </div>
          {block.optionSource?.kind === 'model' ? (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Options are loaded from {FORM_MODEL_OPTION_SOURCE_OPTIONS.find((item) => item.value === modelOptionSource)?.label.toLowerCase()} when the form is opened.
            </p>
          ) : (
          <>
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
                variant="destructive"
                size="icon"
                onClick={() => onChange({ ...block, options: block.options.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          </>
          )}
        </div>
      )}
      {block.type === 'number' && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Display</Label>
            <OptionSelect
              items={NUMBER_DISPLAY_OPTIONS}
              value={block.display}
              onValueChange={(display) =>
                onChange({
                  ...block,
                  display: display === 'slider' || display === 'rating' ? display : 'input',
                })
              }
              placeholder="Display"
            />
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
