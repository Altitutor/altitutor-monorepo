"use client";

import { useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Eye, FileText, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Badge, Button, DataTable, Input, InterviewReviewMockHistory, Label, ResponsiveResizablePanels, RichTextEditor,
  SearchableSelect, SmartDatePickerField, TablePagination, type JSONContent,
} from "@altitutor/ui";
import { formatInterviewReviewDate as reviewDate, performanceReviewPath as reviewRoot, tutorDefaultDisplaySettings,
  type DataTableColumnDefinition, type DataTableFilterDefinition, type InterviewReviewFields,
  type InterviewReviewTemplate as Template, type Json, type TutorInterviewReview as Review,
  type TutorInterviewReviewSummary as ReviewSummary } from "@altitutor/shared";
import { TutorEntityToolbar } from "@/features/quick-filters/components/TutorEntityToolbar";
import { TutorPageContainer } from "@/shared/components/layouts";
import { TutorDialogShell } from "@/shared/components/tutor-dialog-shell";
import { tutorBtnOutline, tutorBtnPrimary, tutorCardCn, tutorDataTableProps, tutorToolbarProps } from "@/shared/lib/tutor-visual";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import { useCurrentStaff } from "@/features/staff/hooks/useStaffQuery";
import { readInterviewReviewTemplate, useInterviewReview, useInterviewReviewCommand, useInterviewReviewMocks,
  useInterviewReviewTemplate, useInterviewReviewWorkspace, type ReviewStudent, type ReviewTemplateSummary } from "../hooks/use-interview-performance-reviews";
import { useInterviewLeaveGuard } from "../hooks/use-interview-leave-guard";
import { InterviewError } from "./interview-ui";
import { useInterviewAccess } from "../hooks/use-interview-access";
import { InterviewPageHeader } from "./interview-page";
import { matchesMulti, pageRows, sortRows, useInterviewTable } from "./interview-table";
const blank: Json = { type: "doc", content: [{ type: "paragraph" }] };
const rootCrumbs = [{ label: "Interviews", href: "/interviews" }, { label: "Performance reviews", href: reviewRoot }];
type Editor = Parameters<NonNullable<ComponentProps<typeof RichTextEditor>["onEditorReady"]>>[0];

const reviewColumns: DataTableColumnDefinition[] = [
  { key: "title", label: "Title", visibleByDefault: true },
  { key: "date", label: "Date", visibleByDefault: true },
  { key: "student", label: "Student", visibleByDefault: true },
  { key: "tutor", label: "Tutor", visibleByDefault: true },
  { key: "template", label: "Template", visibleByDefault: true },
  { key: "status", label: "Status", visibleByDefault: true },
];
const reviewColumnKeys = reviewColumns.map(({ key }) => key);
const reviewSortOptions = reviewColumns.map(({ key, label }) => ({ key, label }));
const defaultReviewView = tutorDefaultDisplaySettings(reviewColumnKeys);
const noStudent = "__no_student__";
const noTemplate = "__no_template__";

function reviewStatus(review: ReviewSummary) {
  return review.published ? "Published" : "Draft";
}


function UnsavedReviewGuard({ template = false }: { template?: boolean }) {
  const guard = useInterviewLeaveGuard();
  return (
    <TutorDialogShell open={guard.open} onOpenChange={(open) => { if (!open) guard.cancel(); }}
      title="Leave without saving?" description="Changes since your last save will be lost." size="compact"
      footer={<><Button variant="outline" onClick={guard.cancel}>Keep editing</Button><Button onClick={guard.leave}>Discard changes</Button></>}>
      <p className="text-sm text-muted-foreground">{template ? "Save your template to resume editing later." : "Save your draft to resume editing later."}</p>
    </TutorDialogShell>
  );
}

function ReviewPreviewDialog({ review, close }: { review: ReviewSummary | null; close: () => void }) {
  const record = useInterviewReview(review?.id);
  const content = record.data?.published?.body ?? record.data?.body;
  return (
    <TutorDialogShell open={Boolean(review)} onOpenChange={(open) => { if (!open) close(); }}
      title={(review?.published ?? review)?.title || "Performance review"}
      description={review ? [review.student, reviewDate((review.published ?? review).date), review.author].filter(Boolean).join(" · ") : undefined}>
      <div className="h-full overflow-y-auto">
        {content ? <RichTextEditor allowMedia={false} content={content as JSONContent} editable={false} autoHeight /> :
          record.error ? <InterviewError error={record.error} retry={() => void record.refetch()} /> :
          <p className="text-sm text-muted-foreground" role="status">Loading review…</p>}
      </div>
    </TutorDialogShell>
  );
}

function ReviewEditor({ record, reviews, templates, students, authorId }: {
  record: Review; reviews: ReviewSummary[]; templates: ReviewTemplateSummary[]; students: ReviewStudent[]; authorId: string | undefined;
}) {
  const router = useRouter();
  const command = useInterviewReviewCommand();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState<ReviewSummary | null>(null);
  const [inserting, setInserting] = useState(false);
  const [draft, setDraft] = useState<InterviewReviewFields>({
    studentId: record.studentId, date: record.date, template: record.template, title: record.title ?? "", body: record.body,
  });
  const [version, setVersion] = useState(record.version);
  const [dirty, setDirty] = useState(false);
  const editable = record.authorId === authorId && version !== null;
  const review = { ...record, ...draft };
  const student = students.find((item) => item.id === review.studentId) ?? null;
  const mocks = useInterviewReviewMocks(review.studentId);
  const history = mocks.data ?? [];

  function update(changes: Partial<InterviewReviewFields>) {
    setDraft((current) => ({ ...current, ...changes }));
    setDirty(true);
  }

  async function insertTemplate(template: ReviewTemplateSummary | null) {
    if (!template || !editor || inserting) return;
    setInserting(true);
    try {
      const saved = await readInterviewReviewTemplate(template.id);
      if (editor.isDestroyed) return;
      editor.chain().focus().insertContent((saved.body as JSONContent).content ?? []).run();
      update({ template: saved.name, ...(saved.title ? { title: saved.title } : {}) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load template.");
    } finally {
      setInserting(false);
    }
  }

  async function save(publish: boolean) {
    if (!editable || version === null || command.isPending || inserting) return;
    try {
      const result = await command.mutateAsync({
        type: publish ? "publishReview" : "saveReview", id: review.id, expectedVersion: version, fields: draft,
      });
      setVersion(result.version);
      setDirty(false);
      if (publish) {
        setPublishing(false);
        toast.success("Performance review published");
        router.push(reviewRoot);
      } else toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save performance review.");
    }
  }

  const previous = reviews.filter((item) => item.id !== review.id && item.published?.studentId === review.studentId &&
    (!review.date || item.published.date <= review.date));
  const canPublish = Boolean(student && review.date && editor?.getText().trim() && (!record.published || record.editing || dirty));

  return (
    <>
      <InterviewPageHeader title={review.title?.trim() || "Performance review"} backHref={reviewRoot} breadcrumbs={[...rootCrumbs, { label: "Review" }]}
        actions={editable && <div className="flex flex-wrap gap-2">
          <Button variant="outline" className={tutorBtnOutline} disabled={!dirty || !review.date || command.isPending || inserting} onClick={() => void save(false)}>Save draft</Button>
          <Button className={tutorBtnPrimary} disabled={!canPublish || command.isPending || inserting} onClick={() => setPublishing(true)}>{review.published ? "Publish correction" : "Publish"}</Button>
        </div>}
      />
      {editable && dirty && <UnsavedReviewGuard />}
      <div className="min-h-0 lg:h-[calc(100dvh-245px)] lg:min-h-[34rem]">
        <ResponsiveResizablePanels id="performance-review-editor" breakpoint="lg" stackOnNarrow
          primaryDefaultSize="65%" primaryMinSize={420} secondaryDefaultSize={360} secondaryMinSize={280} secondaryMaxSize={640}
          handleLabel="Resize performance review sidebar"
          primary={
            <section className="flex h-full min-w-0 flex-col overflow-hidden pr-4" aria-label="Performance review document" data-rich-text-toolbar-container>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <Badge variant="secondary">{editable && (dirty || review.editing) ? review.published ? "Draft correction" : "Draft" : reviewStatus(review)}</Badge>
                {review.template && <span className="text-xs text-muted-foreground">{review.template}</span>}
                {editable && (
                  <div className="ml-auto flex flex-wrap items-center gap-2" role="toolbar" aria-label="Review document actions">
                    {review.published && <Button variant="ghost" size="sm" onClick={() => setPreview(review)}><Eye className="size-4" /> View published version</Button>}
                    <SearchableSelect ariaLabel="Insert template" items={templates} value={null}
                      getItemLabel={(item) => item.name} getItemId={(item) => item.id} placeholder="Insert template"
                      searchPlaceholder="Search templates…" triggerVariant="outline" align="end" disabled={command.isPending || inserting || !templates.length}
                      onValueChange={(item) => void insertTemplate(item)} />
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-16">
                <RichTextEditor allowMedia={false} content={review.body as JSONContent} editable={editable && !command.isPending} onEditorReady={setEditor}
                  onChange={(body) => update({ body: body as Json })} autoHeight floatingToolbar={editable}
                  className="[&_.ProseMirror]:min-h-72"
                  placeholder="Write feedback and next steps for the student…" />
              </div>
            </section>
          }
          secondary={
            <aside className="h-full space-y-4 overflow-y-auto p-1 pl-3" aria-label="Performance review sidebar">
              <section className={tutorCardCn("space-y-3 p-4")}>
                <h2 className="font-semibold">Properties</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="review-title">Title (optional)</Label>
                  <Input id="review-title" value={review.title ?? ""} maxLength={160}
                    onChange={(event) => update({ title: event.target.value })}
                    readOnly={!editable} disabled={command.isPending || inserting} placeholder="Performance review" />
                </div>
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <SearchableSelect ariaLabel="Student" items={students} value={student} onValueChange={(item) => update({ studentId: item?.id ?? null })}
                    getItemLabel={(item) => item.name} getItemId={(item) => item.id} placeholder="Select student"
                    searchPlaceholder="Search students…" fullWidth disabled={!editable || command.isPending || Boolean(review.published)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Review date</Label>
                  <SmartDatePickerField value={review.date} onChange={(date) => update({ date: date ?? "" })} disabled={!editable || command.isPending} />
                </div>
              </section>
              <section className={tutorCardCn("space-y-2 p-4")} aria-label="Mock history">
                <h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-4" /> Mock history</h2>
                {mocks.error ? <InterviewError error={mocks.error} retry={() => void mocks.refetch()} /> :
                  review.studentId && mocks.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading mocks…</p> :
                  history.length ? history.map((round) => <InterviewReviewMockHistory key={round.id} round={round} />) :
                  <p className="text-sm text-muted-foreground">{review.studentId ? "No completed mocks for this student yet." : "Select a student to view their mocks."}</p>}
              </section>
              {previous.length > 0 && (
                <section className={tutorCardCn("space-y-2 p-4")}>
                  <h2 className="font-semibold">Previous performance reviews</h2>
                  {previous.map((item) => <button key={item.id} type="button" onClick={() => setPreview(item)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                    <span><strong className="block">{reviewDate(item.published?.date ?? "")}</strong><span className="text-muted-foreground">{item.published?.title || item.published?.template || "Performance review"} · {item.author}</span></span>
                    <Eye className="size-4 shrink-0 text-muted-foreground" />
                  </button>)}
                </section>
              )}
            </aside>
          }
        />
      </div>

      <TutorDialogShell open={publishing} onOpenChange={setPublishing} title={review.published ? "Publish this correction?" : "Publish this performance review?"} size="compact"
        description={student ? student.name + " will be notified and can read this version in Interviews." : undefined}
        footer={<>
          <Button variant="outline" onClick={() => setPublishing(false)}>Keep as draft</Button>
          <Button className={tutorBtnPrimary} disabled={command.isPending || inserting} onClick={() => void save(true)}>Confirm publish</Button>
        </>}><p className="text-sm text-muted-foreground">Review date · {reviewDate(review.date)}</p></TutorDialogShell>
      <ReviewPreviewDialog review={preview} close={() => setPreview(null)} />
    </>
  );
}

function TemplateEditor({ template, save, pending }: { template: Template; save: (template: Template) => void; pending: boolean }) {
  const [id] = useState(() => template.id || crypto.randomUUID());
  const [name, setName] = useState(template.name);
  const [title, setTitle] = useState(template.title ?? "");
  const [body, setBody] = useState(template.body);
  const [editor, setEditor] = useState<Editor | null>(null);
  const dirty = name !== template.name || title !== (template.title ?? "") ||
    JSON.stringify(body) !== JSON.stringify(template.body);
  return (
    <>
      <InterviewPageHeader title={template.name ? "Edit template" : "New template"} backHref={reviewRoot + "/templates"}
        breadcrumbs={[...rootCrumbs, { label: "Templates", href: reviewRoot + "/templates" }, { label: "Template" }]}
        actions={<Button className={tutorBtnPrimary} disabled={pending || !dirty || !name.trim() || !editor?.getText().trim()}
          onClick={() => save({ ...template, id, name: name.trim(), title: title.trim(), body })}>Save template</Button>} />
      {dirty && <UnsavedReviewGuard template />}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-h-[calc(100dvh-12rem)] min-w-0 pb-20" data-rich-text-toolbar-container aria-label="Template document">
          <RichTextEditor allowMedia={false} content={body as JSONContent} onChange={(value) => setBody(value as Json)}
            onChangeDebounceMs={0} onEditorReady={setEditor} editable={!pending} autoHeight floatingToolbar
            className="border-0 bg-transparent p-0 [&_.ProseMirror]:min-h-72"
            placeholder="Write the starting content for this template…" />
        </section>
        <aside className={tutorCardCn("order-first space-y-4 p-4 lg:order-none")} aria-label="Template properties">
          <h2 className="font-semibold">Properties</h2>
          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input id="template-name" value={name} maxLength={160} disabled={pending} onChange={(event) => setName(event.target.value)} placeholder="Template name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-review-title">Review title (optional)</Label>
            <Input id="template-review-title" value={title} maxLength={160} disabled={pending}
              onChange={(event) => setTitle(event.target.value)} placeholder="Prefill the review title" />
          </div>
        </aside>
      </div>
    </>
  );
}

export function TutorPerformanceReviewsPage({ path }: { path: string[] }) {
  const router = useRouter();
  const go = (suffix: string) => router.push(reviewRoot + suffix);
  const access = useInterviewAccess();
  const staff = useCurrentStaff(access.data === true);
  const workspace = useInterviewReviewWorkspace(access.data === true);
  const command = useInterviewReviewCommand();
  const pendingCreate = useRef<string | null>(null);
  const { reviews = [], templates = [], students = [] } = workspace.data ?? {};
  const authorId = staff.data?.id ?? undefined;
  const table = useInterviewTable(reviewColumnKeys);
  const templateTable = useInterviewTable([]);
  const pagedTemplates = pageRows(templates, templateTable.state.page, templateTable.state.pageSize);
  const [viewing, setViewing] = useState<ReviewSummary | null>(null);
  const reviewRecord = useInterviewReview(access.data && path[0] !== "templates" ? path[0] : undefined);
  const templateRecord = useInterviewReviewTemplate(access.data && path[0] === "templates" && path[1] !== "new" ? path[1] : undefined);
  const selected = reviewRecord.data;
  const template = path[1] === "new" ? { id: "", name: "", body: blank, version: 0 } : templateRecord.data;
  const studentFilters = new Map(students.map(({ id, name }) => [id, name]));
  for (const review of reviews) {
    if (review.studentId && review.student) studentFilters.set(review.studentId, review.student);
  }
  const filterDefinitions: DataTableFilterDefinition[] = [
    { key: "date", label: "Date", type: "date-range", fromKey: "reviewFrom", toKey: "reviewTo" },
    { key: "student", label: "Student", searchable: true, searchPlaceholder: "Search students…",
      options: [...Array.from(studentFilters, ([value, label]) => ({ value, label })), { value: noStudent, label: "No student selected" }] },
    { key: "tutor", label: "Tutor", searchable: true, searchPlaceholder: "Search tutors…",
      options: Array.from(new Map(reviews.map(({ authorId, author }) => [authorId, author])), ([value, label]) => ({ value, label })) },
    { key: "template", label: "Template", searchable: true, searchPlaceholder: "Search templates…",
      options: [
        ...Array.from(new Set([...templates.map(({ name }) => name), ...reviews.flatMap(({ template }) => template ? [template] : [])]),
          (name) => ({ value: name, label: name })),
        { value: noTemplate, label: "No template" },
      ] },
    { key: "status", label: "Status", options: ["Draft", "Published"].map((status) => ({ value: status, label: status })) },
  ];
  const { filters, search } = table.state;
  const from = String(filters.reviewFrom?.[0] ?? "").slice(0, 10);
  const to = String(filters.reviewTo?.[0] ?? "").slice(0, 10);
  const query = search.trim().toLowerCase();
  const rows = sortRows(reviews.filter((review) =>
    (!from || (review.date && review.date >= from)) && (!to || (review.date && review.date <= to)) &&
    matchesMulti(filters, "student", review.studentId || noStudent) &&
    matchesMulti(filters, "tutor", review.authorId) &&
    matchesMulti(filters, "template", review.template || noTemplate) &&
    matchesMulti(filters, "status", reviewStatus(review)) &&
    [review.title, review.student, review.author, review.template, reviewStatus(review), reviewDate(review.date)]
      .some((value) => value?.toLowerCase().includes(query)),
  ), table.state, "date", {
    title: (review) => review.title ?? "",
    date: (review) => review.date,
    student: (review) => review.student ?? "",
    tutor: (review) => review.author,
    template: (review) => review.template,
    status: reviewStatus,
  });
  const paged = pageRows(rows, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);

  async function createReview() {
    if (command.isPending) return;
    const id = pendingCreate.current ??= crypto.randomUUID();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Adelaide" }).format(new Date());
    try {
      await command.mutateAsync({ type: "createReview", id, date });
      pendingCreate.current = null;
      go("/" + id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create performance review.");
    }
  }

  if (access.error && access.data === undefined) return <InterviewError error={access.error} retry={() => void access.refetch()} />;
  if (access.isPending) return <p className="py-8" role="status">Loading performance reviews…</p>;
  if (!access.data) return <p className="py-8">Medicine Interview tutor access is required.</p>;
  if (workspace.error && !workspace.data) return <InterviewError error={workspace.error} retry={() => void workspace.refetch()} />;
  if (staff.error && !staff.data) return <InterviewError error={staff.error} retry={() => void staff.refetch()} />;
  if (workspace.isPending || staff.isPending) return <p className="py-8" role="status">Loading performance reviews…</p>;
  const selectedQuery = path[0] === "templates" ? (path[1] && path[1] !== "new" ? templateRecord : null) : path[0] ? reviewRecord : null;
  if (selectedQuery?.isPending) return <p className="py-8" role="status">Loading performance review…</p>;
  if (selectedQuery?.error && !selectedQuery.data)
    return <InterviewError error={selectedQuery.error} retry={() => void selectedQuery.refetch()} />;

  return (
    <TutorPageContainer className="space-y-6">
      {path[0] === "templates" ? template ? (
        <TemplateEditor key={path[1]} template={template} pending={command.isPending} save={(saved) => {
          void command.mutateAsync({ type: "saveTemplate", id: saved.id, expectedVersion: saved.version, name: saved.name, title: saved.title ?? "", body: saved.body })
            .then(() => { go("/templates"); toast.success("Template saved"); })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Unable to save template."));
        }} />
      ) : <>
        <InterviewPageHeader title="Performance review templates" backHref={reviewRoot} breadcrumbs={[...rootCrumbs, { label: "Templates" }]}
          actions={<Button className={tutorBtnPrimary} onClick={() => go("/templates/new")}><Plus className="size-4" /> New template</Button>} />
        <DataTable {...tutorDataTableProps} pagination="external" data={pagedTemplates.rows} columns={[
          { accessorKey: "name", header: "Template" },
          { id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end"><UcatRowActions actions={[
            { label: "Edit template", icon: <Pencil className="size-4" />, onClick: () => go("/templates/" + row.original.id) },
          ]} /></div> },
        ]} />
        {pagedTemplates.total > 0 && <TablePagination page={pagedTemplates.page} pageSize={templateTable.state.pageSize} total={pagedTemplates.total}
          onPageChange={templateTable.actions.onPageChange} onPageSizeChange={templateTable.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]} className="pt-3" />}
      </> : selected ? (
        <ReviewEditor key={selected.id} record={selected} reviews={reviews} templates={templates} students={students} authorId={authorId} />
      ) : <>
        <InterviewPageHeader title="Performance reviews" breadcrumbs={rootCrumbs}
          actions={<div className="flex flex-wrap gap-2">
            <Button variant="outline" className={tutorBtnOutline} onClick={() => go("/templates")}><FileText className="size-4" /> Templates</Button>
            <Button className={tutorBtnPrimary} disabled={command.isPending} onClick={() => void createReview()}><Plus className="size-4" /> New performance review</Button>
          </div>} />
        {path[0] && <p className="text-sm text-muted-foreground">This performance review is unavailable.</p>}
        <TutorEntityToolbar
          pageKey="interview_performance_reviews"
          defaultSettings={defaultReviewView}
          state={table.state}
          onSearchChange={table.actions.onSearchChange}
          onFiltersChange={table.actions.onFiltersChange}
          onSortChange={table.actions.onSortChange}
          onGroupByChange={table.actions.onGroupByChange}
          onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
          onQuickFilterApply={table.actions.onQuickFilterApply}
          onReset={table.actions.onReset}
          filterDefinitions={filterDefinitions}
          columnDefinitions={reviewColumns}
          sortOptions={reviewSortOptions}
          searchPlaceholder="Search performance reviews…"
          {...tutorToolbarProps}
        />
        <DataTable {...tutorDataTableProps} pagination="external" data={paged.rows} columns={[
          ...[
            { id: "title", header: "Title", cell: ({ row }: { row: { original: ReviewSummary } }) => row.original.title || "Performance review" },
            { id: "date", header: "Date", cell: ({ row }: { row: { original: ReviewSummary } }) => reviewDate(row.original.date) },
            { id: "student", header: "Student", cell: ({ row }: { row: { original: ReviewSummary } }) => row.original.student ?? "No student selected" },
            { id: "tutor", header: "Tutor", cell: ({ row }: { row: { original: ReviewSummary } }) => row.original.author },
            { id: "template", header: "Template", cell: ({ row }: { row: { original: ReviewSummary } }) => row.original.template || "—" },
            { id: "status", header: "Status", cell: ({ row }: { row: { original: ReviewSummary } }) => (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{reviewStatus(row.original)}</Badge>
                {row.original.authorId === authorId && row.original.published && row.original.editing &&
                  <span className="text-xs text-muted-foreground">Draft correction</span>}
              </div>
            ) },
          ].filter((column) => visible.has(column.id)),
          { id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end"><UcatRowActions actions={[
            { label: "View", icon: <Eye className="size-4" />, onClick: () => setViewing(row.original) },
            ...(row.original.authorId === authorId ? [{ label: "Edit", icon: <Pencil className="size-4" />, onClick: () => go("/" + row.original.id) }] : []),
          ]} /></div> },
        ]} />
        {paged.total > 0 && <TablePagination page={paged.page} pageSize={table.state.pageSize} total={paged.total}
          onPageChange={table.actions.onPageChange} onPageSizeChange={table.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]} className="pt-3" />}
        <ReviewPreviewDialog review={viewing} close={() => setViewing(null)} />
      </>}
    </TutorPageContainer>
  );
}
