"use client";

// DEV-8 THROWAWAY: selected bank B, builder A, and an interviews table.
// Earlier structural variants remain available only in explicit comparison mode.
// All content is mock and in memory; this is not the implementation's data layer.
import { useState, type ReactNode, type SetStateAction } from "react";
import type { DataTableState } from "@altitutor/shared";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  DataTable,
  DataTableToolbar,
  DropdownMenuCheckboxItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import {
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  Tag,
  X,
} from "lucide-react";
import { PrototypeSwitcher } from "@/shared/components/prototype-switcher";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorSurfaceCard,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorDataTableProps,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";
import { cn, navActiveStyles } from "@/shared/utils";
import {
  initialCategories,
  initialQuestions,
  initialInterviews,
  type PrototypeInterview,
  initialTags,
  type PrototypeQuestion,
  type PrototypeStation,
} from "./authoring-data";

const variants = [
  { key: "A", name: "Table & focused editor" },
  { key: "B", name: "Browse beside your work" },
  { key: "C", name: "Category cards & station board" },
];
const initialToolbarState = (): DataTableState => ({
  search: "",
  filters: {},
  sortBy: null,
  sortDirection: "asc",
  groupBy: null,
  page: 1,
  pageSize: 20,
  visibleColumns: ["category", "tags", "seconds"],
});
const fieldClass =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const pillClass =
  "inline-flex rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground";
const categoryPath = (category: { name: string; group: string }) =>
  category.group ? `${category.group} → ${category.name}` : category.name;
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// These deliberately disagree about information hierarchy, not just colour.
export function AuthoringVariantA({
  navigation,
  main,
}: {
  navigation: ReactNode;
  main: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[210px_minmax(0,1fr)]">
      {navigation}
      <div className="min-w-0">{main}</div>
    </div>
  );
}
export function AuthoringVariantB({
  list,
  detail,
}: {
  list: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,.85fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">{list}</div>
      <div className="min-w-0 xl:sticky xl:top-20">{detail}</div>
    </div>
  );
}
export function AuthoringVariantC({ overview }: { overview: ReactNode }) {
  return <div className="space-y-6">{overview}</div>;
}

export function InterviewAuthoringPrototype() {
  const router = useRouter();
  const params = useSearchParams();
  const screen =
    params.get("screen") === "bank"
      ? "bank"
      : params.get("screen") === "builder"
        ? "builder"
        : "interviews";
  const comparing = params.get("compare") === "1";
  const variant =
    comparing && ["A", "B", "C"].includes(params.get("variant") ?? "")
      ? params.get("variant")
      : screen === "bank"
        ? "B"
        : "A";
  const [questions, setQuestions] = useState(initialQuestions);
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [interviews, setInterviews] = useState(initialInterviews);
  const selectedInterview =
    interviews.find((interview) => interview.id === params.get("interview")) ??
    interviews[0];
  const {
    stations,
    name: interviewName,
    readingMinutes,
    questionMinutes,
  } = selectedInterview;
  const updateInterview = (patch: Partial<PrototypeInterview>) =>
    setInterviews((current) =>
      current.map((interview) =>
        interview.id === selectedInterview.id
          ? { ...interview, ...patch }
          : interview,
      ),
    );
  const setStations = (next: SetStateAction<PrototypeStation[]>) =>
    setInterviews((current) =>
      current.map((interview) =>
        interview.id === selectedInterview.id
          ? {
              ...interview,
              stations:
                typeof next === "function" ? next(interview.stations) : next,
            }
          : interview,
      ),
    );
  const setInterviewName = (name: string) => updateInterview({ name });
  const setReadingMinutes = (value: number) =>
    updateInterview({ readingMinutes: value });
  const setQuestionMinutes = (value: number) =>
    updateInterview({ questionMinutes: value });
  const [selectedStationId, setSelectedStationId] = useState("s1");
  const [selectedQuestionId, setSelectedQuestionId] = useState("q1");
  const [questionToolbar, setQuestionToolbar] = useState(initialToolbarState);
  const [interviewToolbar, setInterviewToolbar] = useState<DataTableState>(
    () => ({
      ...initialToolbarState(),
      visibleColumns: ["stations", "questions", "timing", "points"],
    }),
  );
  const [searchScopes, setSearchScopes] = useState([
    "question",
    "prompt",
    "rubric",
  ]);
  const categoryFilter = String(questionToolbar.filters.category?.[0] ?? "all");
  const setCategoryFilter = (value: string) =>
    setQuestionToolbar((current) => ({
      ...current,
      filters: { ...current.filters, category: value === "all" ? [] : [value] },
    }));
  const [showArchived, setShowArchived] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<PrototypeQuestion | null>(
    null,
  );
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newTag, setNewTag] = useState("");
  const [bankPicker, setBankPicker] = useState(false);
  const [stationDialog, setStationDialog] = useState(false);
  const [printPreview, setPrintPreview] = useState<string | "all" | null>(null);
  const [notice, setNotice] = useState("");
  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? stations[0];
  const filtered = questions
    .filter(
      (question) =>
        question.archived === showArchived &&
        (!questionToolbar.filters.category?.length ||
          questionToolbar.filters.category.includes(question.categoryId)) &&
        (!questionToolbar.filters.tags?.length ||
          question.tagIds.some((tag) =>
            questionToolbar.filters.tags.includes(tag),
          )) &&
        searchScopes
          .map((scope) =>
            scope === "prompt"
              ? question.prompt
              : scope === "rubric"
                ? question.rubric
                : question.question,
          )
          .join(" ")
          .toLowerCase()
          .includes(questionToolbar.search.toLowerCase()),
    )
    .sort((a, b) => {
      const direction = questionToolbar.sortDirection === "asc" ? 1 : -1;
      if (questionToolbar.sortBy === "seconds")
        return (a.seconds - b.seconds) * direction;
      if (questionToolbar.sortBy === "question")
        return a.question.localeCompare(b.question) * direction;
      return 0;
    });
  const filteredInterviews = interviews
    .filter(
      (interview) =>
        interview.name
          .toLowerCase()
          .includes(interviewToolbar.search.toLowerCase()) &&
        (!interviewToolbar.filters.stations?.length ||
          interviewToolbar.filters.stations.includes(
            String(interview.stations.length),
          )),
    )
    .sort((a, b) => {
      const direction = interviewToolbar.sortDirection === "asc" ? 1 : -1;
      if (interviewToolbar.sortBy === "name")
        return a.name.localeCompare(b.name) * direction;
      if (interviewToolbar.sortBy === "stations")
        return (a.stations.length - b.stations.length) * direction;
      if (interviewToolbar.sortBy === "points")
        return (
          (a.stations.reduce((n, station) => n + station.maximum, 0) -
            b.stations.reduce((n, station) => n + station.maximum, 0)) *
          direction
        );
      return 0;
    });
  const selectedQuestion =
    filtered.find((question) => question.id === selectedQuestionId) ??
    filtered[0];
  const totalPoints = stations.reduce(
    (total, station) => total + station.maximum,
    0,
  );
  const placements = stations.flatMap((station) => station.questionIds);
  const repeated = [
    ...new Set(
      placements.filter((id, index) => placements.indexOf(id) !== index),
    ),
  ];
  const getQuestion = (id: string) =>
    questions.find((question) => question.id === id);
  const usedAt = (id: string) =>
    interviews.flatMap((interview) =>
      interview.stations
        .filter((station) => station.questionIds.includes(id))
        .map((station) => ({
          ...station,
          interviewId: interview.id,
          interviewName: interview.name,
        })),
    );
  const clearFilters = () => {
    setQuestionToolbar(initialToolbarState());
    setSearchScopes(["question", "prompt", "rubric"]);
    setShowArchived(false);
  };
  const switchScreen = (next: string, interviewId?: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("screen", next);
    if (interviewId) query.set("interview", interviewId);
    router.push(`/interviews/prototype/authoring?${query.toString()}`, {
      scroll: false,
    });
  };
  const openInterview = (interview: PrototypeInterview) => {
    setSelectedStationId(interview.stations[0]?.id ?? "");
    setNotice("");
    switchScreen("builder", interview.id);
  };
  const createInterview = () => {
    const id = `interview-${Date.now()}`;
    const interview: PrototypeInterview = {
      id,
      name: "Untitled interview",
      readingMinutes: 2,
      questionMinutes: 8,
      stations: [
        { id: `${id}-1`, name: "New station", maximum: 6, questionIds: [] },
      ],
    };
    setInterviews((current) => [...current, interview]);
    openInterview(interview);
  };
  const updateStation = (id: string, patch: Partial<PrototypeStation>) =>
    setStations((current) =>
      current.map((station) =>
        station.id === id ? { ...station, ...patch } : station,
      ),
    );
  const addStation = () => {
    const id = `station-${Date.now()}`;
    setStations([
      ...stations,
      {
        id,
        name: `New station ${stations.length + 1}`,
        maximum: 6,
        questionIds: [],
      },
    ]);
    setSelectedStationId(id);
    if (variant === "C") setStationDialog(true);
  };
  const moveStation = (index: number, direction: number) => {
    const next = [...stations];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setStations(next);
  };
  const moveQuestion = (
    station: PrototypeStation,
    index: number,
    direction: number,
  ) => {
    const next = [...station.questionIds];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    updateStation(station.id, { questionIds: next });
    setNotice(
      index === 0 || index + direction === 0
        ? "Question order changed. The reading and printed prompt now come from the first question."
        : "Question order updated.",
    );
  };
  const addQuestion = (id: string) => {
    if (!selectedStation) return;
    const isRepeated = placements.includes(id);
    updateStation(selectedStation.id, {
      questionIds: [...selectedStation.questionIds, id],
    });
    setNotice(
      isRepeated
        ? `Added to ${selectedStation.name}. This question is repeated in this interview.`
        : `Added to ${selectedStation.name}.`,
    );
  };
  const newQuestionDraft = () =>
    setQuestionDraft({
      id: `q-${Date.now()}`,
      question: "",
      prompt: "",
      rubric: "",
      categoryId: categories[0]?.id ?? "",
      tagIds: [],
      seconds: 120,
      archived: false,
    });
  const saveQuestion = () => {
    if (!questionDraft) return;
    setQuestions((current) =>
      current.some((question) => question.id === questionDraft.id)
        ? current.map((question) =>
            question.id === questionDraft.id ? questionDraft : question,
          )
        : [...current, questionDraft],
    );
    setSelectedQuestionId(questionDraft.id);
    setQuestionDraft(null);
    setNotice(
      "Question saved in this prototype. Prepared interviews use the updated bank question.",
    );
  };
  const archiveQuestion = (id: string, archived: boolean) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, archived } : question,
      ),
    );
    setQuestionDraft(null);
    setNotice(
      archived
        ? "Question archived. Existing station uses are preserved."
        : "Question restored to the bank.",
    );
  };

  const categoryLabel = (id: string) => {
    const category = categories.find((item) => item.id === id);
    return category ? categoryPath(category) : "Uncategorised";
  };
  const tagBadges = (question: PrototypeQuestion) => (
    <span className="flex flex-wrap gap-1">
      {question.tagIds.map((id) => (
        <span key={id} className={pillClass}>
          {tags.find((tag) => tag.id === id)?.name}
        </span>
      ))}
    </span>
  );
  const filters = (
    <section aria-label="Question bank toolbar">
      <DataTableToolbar
        key={screen === "bank" ? "bank-toolbar" : "picker-toolbar"}
        state={questionToolbar}
        onSearchChange={(search) =>
          setQuestionToolbar((current) => ({ ...current, search }))
        }
        onFiltersChange={(filters) =>
          setQuestionToolbar((current) => ({ ...current, filters }))
        }
        onSortChange={(sortBy, sortDirection) =>
          setQuestionToolbar((current) => ({
            ...current,
            sortBy,
            sortDirection,
          }))
        }
        onGroupByChange={(groupBy) =>
          setQuestionToolbar((current) => ({ ...current, groupBy }))
        }
        onVisibleColumnsChange={(visibleColumns) =>
          setQuestionToolbar((current) => ({ ...current, visibleColumns }))
        }
        onQuickFilterApply={() => {}}
        onReset={clearFilters}
        filterDefinitions={[
          {
            key: "category",
            label: "Category",
            options: categories.map((category) => ({
              label: categoryPath(category),
              value: category.id,
            })),
            searchable: true,
          },
          {
            key: "tags",
            label: "Tags",
            options: tags.map((tag) => ({ label: tag.name, value: tag.id })),
            searchable: true,
          },
        ]}
        sortOptions={[
          { key: "question", label: "Question" },
          { key: "seconds", label: "Suggested time" },
        ]}
        columnDefinitions={
          screen === "bank"
            ? [
                { key: "category", label: "Category", visibleByDefault: true },
                { key: "tags", label: "Tags", visibleByDefault: true },
                {
                  key: "seconds",
                  label: "Suggested time",
                  visibleByDefault: true,
                },
              ]
            : []
        }
        defaultVisibleColumns={["category", "tags", "seconds"]}
        searchPlaceholder="Search interview questions"
        searchFromOptions={[
          { value: "question", label: "Question text" },
          { value: "prompt", label: "Prompt" },
          { value: "rubric", label: "Rubric" },
        ]}
        searchFromValue={searchScopes}
        onSearchFromChange={(scopes) =>
          setSearchScopes(scopes.length ? scopes : ["question"])
        }
        filterFooter={
          <DropdownMenuCheckboxItem
            checked={showArchived}
            onCheckedChange={setShowArchived}
            onSelect={(event) => event.preventDefault()}
          >
            Show archived only
          </DropdownMenuCheckboxItem>
        }
        showDeletedActive={showArchived}
        onClearShowDeleted={() => setShowArchived(false)}
        {...tutorToolbarProps}
      />
    </section>
  );
  const categoryNavigation = (
    <aside className={cn(tutorSurfaceCard, "p-3")}>
      <h2 className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Categories
      </h2>
      <button
        className={cn(
          "w-full rounded-xl px-3 py-2.5 text-left text-sm",
          categoryFilter === "all" && navActiveStyles,
        )}
        onClick={() => setCategoryFilter("all")}
      >
        All questions{" "}
        <span className="float-right text-xs">
          {
            questions.filter((question) => question.archived === showArchived)
              .length
          }
        </span>
      </button>
      {[...new Set(categories.map((category) => category.group))].map(
        (group) => (
          <div key={group}>
            <div className="px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground">
              {group || "General"}
            </div>
            {categories
              .filter((category) => category.group === group)
              .map((category) => (
                <button
                  key={category.id}
                  className={cn(
                    "mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs",
                    categoryFilter === category.id
                      ? navActiveStyles
                      : "hover:bg-muted/40",
                  )}
                  onClick={() => setCategoryFilter(category.id)}
                >
                  {category.name}
                  <span className="text-muted-foreground">
                    {
                      questions.filter(
                        (question) =>
                          question.categoryId === category.id &&
                          question.archived === showArchived,
                      ).length
                    }
                  </span>
                </button>
              ))}
          </div>
        ),
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-4 w-full gap-2"
        onClick={() => setTaxonomyOpen(true)}
      >
        <Settings2 size={14} />
        Manage categories & tags
      </Button>
    </aside>
  );
  const questionDetail = (question: PrototypeQuestion) => (
    <section className={cn(tutorSurfaceCard, "space-y-5 p-6")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 text-xs text-muted-foreground">
            {categoryLabel(question.categoryId)}
          </div>
          <h2 className="text-xl font-semibold leading-snug">
            {question.question}
          </h2>
        </div>
        <Button
          aria-label="Edit selected question"
          variant="outline"
          size="sm"
          className={tutorBtnOutline}
          onClick={() =>
            setQuestionDraft({ ...question, tagIds: [...question.tagIds] })
          }
        >
          <Pencil size={14} className="mr-2" />
          Edit
        </Button>
      </div>
      {tagBadges(question)}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 size={14} />
        Suggested time {duration(question.seconds)}
        {question.archived && <span className={pillClass}>Archived</span>}
      </div>
      <div className="rounded-xl bg-muted/35 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
          Reading prompt
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {question.prompt ||
            "No reading prompt. If placed first, this station will need a prompt before printing."}
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rubric
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {question.rubric || "No rubric yet."}
        </p>
      </div>
      <div className="border-t pt-4">
        <h3 className="mb-2 text-xs font-medium">Used in interviews</h3>
        {usedAt(question.id).length ? (
          usedAt(question.id).map((station) => (
            <button
              key={station.id}
              className="mb-2 flex w-full items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-left text-xs"
              onClick={() => {
                setSelectedStationId(station.id);
                switchScreen("builder", station.interviewId);
              }}
            >
              {station.interviewName} · {station.name}
              <ChevronRight size={14} />
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Not used in an interview yet.
          </p>
        )}
      </div>
    </section>
  );
  const emptyBank = (
    <div className={cn(tutorSurfaceCard, "p-12 text-center")}>
      <Search className="mx-auto mb-3 text-muted-foreground" />
      <h3 className="font-medium">No matching questions</h3>
      <Button variant="ghost" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  );
  const bankTable = (
    <div className={cn(tutorSurfaceCard, "overflow-x-auto")}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className={tutorTableHeaderRow}>
            <th className="p-4 font-medium">Question</th>
            <th className="p-4 font-medium">Category</th>
            <th className="p-4 font-medium">Tags</th>
            <th className="p-4 font-medium">Time</th>
            <th className="p-4">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((question) => (
            <tr key={question.id} className={tutorTableBodyRow}>
              <td className="max-w-sm p-4">
                <button
                  className="text-left font-medium hover:underline"
                  onClick={() =>
                    setQuestionDraft({
                      ...question,
                      tagIds: [...question.tagIds],
                    })
                  }
                >
                  {question.question}
                </button>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {question.prompt || "No prompt"}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {usedAt(question.id).length} station uses
                </p>
              </td>
              <td className="p-4 text-xs text-muted-foreground">
                {categoryLabel(question.categoryId)}
              </td>
              <td className="min-w-32 p-4">{tagBadges(question)}</td>
              <td className="whitespace-nowrap p-4 text-xs">
                {duration(question.seconds)}
              </td>
              <td className="p-4">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${question.question}`}
                  onClick={() =>
                    setQuestionDraft({
                      ...question,
                      tagIds: [...question.tagIds],
                    })
                  }
                >
                  <Pencil size={15} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtered.length && emptyBank}
    </div>
  );
  const bankList = (
    <div className={cn(tutorSurfaceCard, "overflow-hidden")}>
      {filtered.map((question) => (
        <button
          key={question.id}
          className={cn(
            "block w-full border-b p-4 text-left last:border-b-0",
            selectedQuestion?.id === question.id
              ? navActiveStyles
              : "hover:bg-muted/30",
          )}
          onClick={() => setSelectedQuestionId(question.id)}
        >
          <div className="mb-2 text-[10px] text-muted-foreground">
            {questionToolbar.visibleColumns.includes("category") &&
              categoryLabel(question.categoryId)}
            {questionToolbar.visibleColumns.includes("category") &&
              questionToolbar.visibleColumns.includes("seconds") &&
              " · "}
            {questionToolbar.visibleColumns.includes("seconds") &&
              duration(question.seconds)}
          </div>
          <h3 className="text-sm font-medium leading-relaxed">
            {question.question}
          </h3>
          {questionToolbar.visibleColumns.includes("tags") && (
            <div className="mt-3">{tagBadges(question)}</div>
          )}
        </button>
      ))}
      {!filtered.length && emptyBank}
    </div>
  );
  const bankCards = (
    <div className="space-y-6">
      {[...new Set(filtered.map((question) => question.categoryId))].map(
        (id) => (
          <section key={id}>
            <h2 className="mb-3 text-sm font-semibold">{categoryLabel(id)}</h2>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered
                .filter((question) => question.categoryId === id)
                .map((question) => (
                  <button
                    key={question.id}
                    className={cn(
                      tutorSurfaceCard,
                      "p-5 text-left transition-colors hover:bg-muted/40",
                    )}
                    onClick={() =>
                      setQuestionDraft({
                        ...question,
                        tagIds: [...question.tagIds],
                      })
                    }
                  >
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock3 size={12} />
                        {duration(question.seconds)}
                      </span>
                      <span>{usedAt(question.id).length} station uses</span>
                    </div>
                    <h3 className="mb-3 text-sm font-semibold leading-relaxed">
                      {question.question}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {question.prompt || "No reading prompt"}
                    </p>
                    {tagBadges(question)}
                  </button>
                ))}
            </div>
          </section>
        ),
      )}
      {!filtered.length && emptyBank}
    </div>
  );

  const stationRail = (
    <aside className={cn(tutorSurfaceCard, "space-y-2 p-3")}>
      <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Stations
      </h2>
      {stations.map((station, index) => (
        <div
          key={station.id}
          className={cn(
            "rounded-xl p-2",
            selectedStation?.id === station.id
              ? navActiveStyles
              : "hover:bg-muted/30",
          )}
        >
          <button
            className="flex w-full items-start gap-2 text-left"
            onClick={() => setSelectedStationId(station.id)}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-background text-[10px]">
              {index + 1}
            </span>
            <div>
              <div className="text-xs font-semibold leading-relaxed">
                {station.name}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {station.questionIds.length} questions · {station.maximum}{" "}
                points
              </div>
            </div>
          </button>
          <div className="mt-2 flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={index === 0}
              aria-label={`Move station ${index + 1} up`}
              onClick={() => moveStation(index, -1)}
            >
              <ArrowUp size={12} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={index === stations.length - 1}
              aria-label={`Move station ${index + 1} down`}
              onClick={() => moveStation(index, 1)}
            >
              <ArrowDown size={12} />
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className={cn(tutorBtnOutline, "w-full gap-2")}
        onClick={addStation}
      >
        <Plus size={14} />
        Add station
      </Button>
    </aside>
  );
  const pickerList = (
    <div className="space-y-3">
      {filters}
      <p className="text-xs text-muted-foreground">
        Add to <strong>{selectedStation?.name}</strong> ·{" "}
        {filtered.filter((question) => !question.archived).length} questions
      </p>
      <div className="max-h-[560px] space-y-2 overflow-auto">
        {filtered
          .filter((question) => !question.archived)
          .map((question) => (
            <div
              key={question.id}
              className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">
                  {categoryLabel(question.categoryId)}
                </div>
                <p className="mt-1 text-xs font-medium leading-relaxed">
                  {question.question}
                </p>
                {placements.includes(question.id) && (
                  <span className="mt-1 block text-[10px] text-amber-600 dark:text-amber-400">
                    Already used in this interview
                  </span>
                )}
              </div>
              <Button
                aria-label={`Add ${question.question}`}
                size="icon"
                variant="outline"
                className={cn(tutorBtnOutline, "h-8 w-8 shrink-0")}
                onClick={() => addQuestion(question.id)}
              >
                <Plus size={14} />
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
  const stationEditor = selectedStation ? (
    <section className={cn(tutorSurfaceCard, "overflow-hidden")}>
      <div className="space-y-4 border-b p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Station {stations.indexOf(selectedStation) + 1}
          </h2>
          <Button
            size="sm"
            variant="outline"
            className={cn(tutorBtnOutline, "gap-2")}
            onClick={() => setPrintPreview(selectedStation.id)}
          >
            <Printer size={14} />
            Preview prompt
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1 text-xs font-medium">
            Station name
            <input
              aria-label="Station name"
              value={selectedStation.name}
              onChange={(event) =>
                updateStation(selectedStation.id, { name: event.target.value })
              }
              className={cn(fieldClass, "mt-2")}
            />
          </label>
          <label className="w-28 text-xs font-medium">
            Maximum points
            <input
              aria-label="Maximum points"
              type="number"
              min={0.1}
              step="any"
              value={selectedStation.maximum}
              onChange={(event) =>
                updateStation(selectedStation.id, {
                  maximum: Math.max(0, Number(event.target.value)),
                })
              }
              className={cn(fieldClass, "mt-2")}
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Students see the station number. This name is for tutors.
        </p>
      </div>
      <div className="space-y-3 p-5">
        {selectedStation.questionIds.map((id, index) => {
          const question = getQuestion(id);
          if (!question) return null;
          return (
            <div key={`${id}-${index}`} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {index === 0 && (
                      <span className={pillClass}>
                        <FileText size={11} className="mr-1" />
                        Provides reading prompt
                      </span>
                    )}
                    {repeated.includes(id) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Repeated question
                      </span>
                    )}
                    {question.archived && (
                      <span className={pillClass}>
                        Archived · existing use retained
                      </span>
                    )}
                  </div>
                  <button
                    className="text-left text-sm font-medium leading-relaxed hover:underline"
                    onClick={() =>
                      setQuestionDraft({
                        ...question,
                        tagIds: [...question.tagIds],
                      })
                    }
                  >
                    {question.question}
                  </button>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {categoryLabel(question.categoryId)} · Suggested{" "}
                    {duration(question.seconds)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    aria-label={`Move question ${index + 1} up`}
                    onClick={() => moveQuestion(selectedStation, index, -1)}
                  >
                    <ArrowUp size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === selectedStation.questionIds.length - 1}
                    aria-label={`Move question ${index + 1} down`}
                    onClick={() => moveQuestion(selectedStation, index, 1)}
                  >
                    <ArrowDown size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remove question ${index + 1} from station`}
                    onClick={() =>
                      updateStation(selectedStation.id, {
                        questionIds: selectedStation.questionIds.filter(
                          (_, at) => at !== index,
                        ),
                      })
                    }
                  >
                    <X size={13} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {!selectedStation.questionIds.length && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add the first question to set this station’s reading prompt.
          </div>
        )}
        <Button
          variant="outline"
          className={cn(tutorBtnOutline, "w-full gap-2")}
          onClick={() => {
            clearFilters();
            setBankPicker(true);
          }}
        >
          <Plus size={15} />
          Add questions from bank
        </Button>
      </div>
      <div className="border-t bg-muted/20 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
          <FileText size={14} />
          Reading & printed prompt
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {getQuestion(selectedStation.questionIds[0])?.prompt ||
            "The first question has no prompt. Add a prompt to that question or move a question with a prompt to the top."}
        </p>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Always taken from question 1. Reordering questions changes this
          prompt.
        </p>
      </div>
    </section>
  ) : null;

  const board = (
    <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      {stations.map((station, index) => (
        <section
          key={station.id}
          className={cn(tutorSurfaceCard, "overflow-hidden")}
        >
          <div className="border-b p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className={pillClass}>Station {index + 1}</span>
              <span className="text-xs text-muted-foreground">
                {station.maximum} points
              </span>
            </div>
            <h2 className="text-base font-semibold">{station.name}</h2>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => {
                  setSelectedStationId(station.id);
                  setStationDialog(true);
                }}
              >
                <Pencil size={13} className="mr-2" />
                Edit station
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Preview station ${index + 1} prompt`}
                onClick={() => setPrintPreview(station.id)}
              >
                <Printer size={14} />
              </Button>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {station.questionIds.map((id, at) => (
              <div key={`${id}-${at}`} className="rounded-lg bg-muted/35 p-3">
                <div className="mb-2 flex gap-2 text-[10px] text-muted-foreground">
                  <span>Question {at + 1}</span>
                  {at === 0 && <span>· Reading prompt</span>}
                  {repeated.includes(id) && (
                    <span className="text-amber-600">· Repeated</span>
                  )}
                </div>
                <p className="text-xs font-medium leading-relaxed">
                  {getQuestion(id)?.question}
                </p>
              </div>
            ))}
            {!station.questionIds.length && (
              <p className="py-5 text-xs text-muted-foreground">
                No questions yet.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className={cn(tutorBtnOutline, "w-full gap-2")}
              onClick={() => {
                setSelectedStationId(station.id);
                clearFilters();
                setBankPicker(true);
              }}
            >
              <Plus size={13} />
              Add question
            </Button>
          </div>
          <div className="border-t bg-muted/20 p-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Printed prompt
            </div>
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {getQuestion(station.questionIds[0])?.prompt ||
                "No reading prompt yet."}
            </p>
          </div>
        </section>
      ))}
      <button
        onClick={addStation}
        className="flex min-h-52 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground hover:bg-muted/30"
      >
        <Plus size={17} />
        Add another station
      </button>
    </div>
  );

  const interviewColumns: ColumnDef<PrototypeInterview>[] = [
    {
      id: "name",
      header: "Interview",
      cell: ({ row }) => (
        <button
          className="py-3 text-left text-sm font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            openInterview(row.original);
          }}
        >
          {row.original.name || "Untitled interview"}
        </button>
      ),
    },
    {
      id: "stations",
      header: "Stations",
      cell: ({ row }) => row.original.stations.length,
    },
    {
      id: "questions",
      header: "Questions",
      cell: ({ row }) =>
        row.original.stations.reduce(
          (total, station) => total + station.questionIds.length,
          0,
        ),
    },
    {
      id: "timing",
      header: "Time per station",
      cell: ({ row }) => (
        <div className="text-xs">
          <span>{row.original.readingMinutes} min reading</span>
          <div className="mt-1 text-muted-foreground">
            {row.original.questionMinutes} min questions
          </div>
        </div>
      ),
    },
    {
      id: "points",
      header: "Total points",
      cell: ({ row }) =>
        row.original.stations.reduce(
          (total, station) => total + station.maximum,
          0,
        ),
    },
    {
      id: "open",
      header: () => <span className="sr-only">Open interview</span>,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open ${row.original.name}`}
          onClick={(event) => {
            event.stopPropagation();
            openInterview(row.original);
          }}
        >
          <ChevronRight size={16} />
        </Button>
      ),
    },
  ];
  const interviewsTable = (
    <div className="space-y-4">
      <DataTableToolbar
        state={interviewToolbar}
        onSearchChange={(search) =>
          setInterviewToolbar((current) => ({ ...current, search }))
        }
        onFiltersChange={(filters) =>
          setInterviewToolbar((current) => ({ ...current, filters }))
        }
        onSortChange={(sortBy, sortDirection) =>
          setInterviewToolbar((current) => ({
            ...current,
            sortBy,
            sortDirection,
          }))
        }
        onGroupByChange={(groupBy) =>
          setInterviewToolbar((current) => ({ ...current, groupBy }))
        }
        onVisibleColumnsChange={(visibleColumns) =>
          setInterviewToolbar((current) => ({ ...current, visibleColumns }))
        }
        onQuickFilterApply={() => {}}
        onReset={() =>
          setInterviewToolbar({
            ...initialToolbarState(),
            visibleColumns: ["stations", "questions", "timing", "points"],
          })
        }
        searchPlaceholder="Search interviews"
        filterDefinitions={[
          {
            key: "stations",
            label: "Station count",
            options: [
              ...new Set(
                interviews.map((interview) => interview.stations.length),
              ),
            ]
              .sort((a, b) => a - b)
              .map((count) => ({
                label: `${count} stations`,
                value: String(count),
              })),
          },
        ]}
        sortOptions={[
          { key: "name", label: "Interview name" },
          { key: "stations", label: "Station count" },
          { key: "points", label: "Total points" },
        ]}
        columnDefinitions={[
          { key: "stations", label: "Stations", visibleByDefault: true },
          { key: "questions", label: "Questions", visibleByDefault: true },
          { key: "timing", label: "Time per station", visibleByDefault: true },
          { key: "points", label: "Total points", visibleByDefault: true },
        ]}
        defaultVisibleColumns={["stations", "questions", "timing", "points"]}
        {...tutorToolbarProps}
      />
      <p className="text-xs text-muted-foreground">
        {filteredInterviews.length} interviews
      </p>
      <DataTable
        columns={[
          interviewColumns[0],
          ...interviewToolbar.visibleColumns.flatMap((id) =>
            interviewColumns.filter((column) => column.id === id),
          ),
          interviewColumns[5],
        ]}
        data={filteredInterviews}
        onRowClick={openInterview}
        getRowClassName={() => "cursor-pointer"}
        {...tutorDataTableProps}
      />
    </div>
  );

  return (
    <div className="space-y-6 pb-28">
      {screen === "builder" && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 gap-2 text-muted-foreground"
          onClick={() => switchScreen("interviews")}
        >
          <ArrowLeft size={14} />
          All interviews
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen size={14} />
            Medicine interviews<span className={pillClass}>Prototype</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {screen === "bank"
              ? "Question bank"
              : screen === "interviews"
                ? "Interviews"
                : interviewName || "Untitled interview"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {screen === "bank"
              ? "Build a shared collection of prompts, questions and marking guidance."
              : screen === "interviews"
                ? "Prepare and manage your mock interviews. Open an interview to edit its stations."
                : "Edit stations, order questions and check what students will read."}
          </p>
        </div>
        <div className="flex gap-2">
          {screen === "bank" && (
            <Button
              variant="outline"
              className={cn(tutorBtnOutline, "gap-2")}
              onClick={() => setTaxonomyOpen(true)}
            >
              <Settings2 size={15} />
              Categories & tags
            </Button>
          )}
          {screen === "bank" ? (
            <Button
              className={cn(tutorBtnPrimary, "gap-2")}
              onClick={newQuestionDraft}
            >
              <Plus size={15} />
              New question
            </Button>
          ) : screen === "interviews" ? (
            <Button
              className={cn(tutorBtnPrimary, "gap-2")}
              onClick={createInterview}
            >
              <Plus size={15} />
              New interview
            </Button>
          ) : (
            <Button
              variant="outline"
              className={cn(tutorBtnOutline, "gap-2")}
              onClick={() => setPrintPreview("all")}
            >
              <Printer size={15} />
              Preview all prompts
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex gap-2">
          {[
            ["interviews", "Interviews"],
            ["bank", "Question bank"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={
                screen === key || (screen === "builder" && key === "interviews")
              }
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm",
                screen === key || (screen === "builder" && key === "interviews")
                  ? navActiveStyles
                  : "text-muted-foreground hover:bg-muted/40",
              )}
              onClick={() => switchScreen(key)}
            >
              {key === "bank" ? <BookOpen size={15} /> : <Layers3 size={15} />}
              {label}
            </button>
          ))}
        </div>
        <Link
          className="text-xs text-muted-foreground hover:underline"
          href="/interviews/prototype?variant=C"
        >
          Open accepted live workspace →
        </Link>
      </div>
      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-xs"
        >
          <span className="flex items-start gap-2">
            <Check size={14} className="shrink-0" />
            {notice}
          </span>
          <button aria-label="Dismiss update" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {screen === "interviews" ? (
        interviewsTable
      ) : screen === "bank" ? (
        <>
          <div className="space-y-3">
            {filters}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} questions · one category, multiple tags
              </span>
              <span>
                {showArchived ? "Archived questions" : "Active questions"}
              </span>
            </div>
          </div>
          {variant === "A" ? (
            <AuthoringVariantA
              navigation={categoryNavigation}
              main={bankTable}
            />
          ) : variant === "B" ? (
            <AuthoringVariantB
              list={bankList}
              detail={
                selectedQuestion ? questionDetail(selectedQuestion) : emptyBank
              }
            />
          ) : (
            <AuthoringVariantC overview={bankCards} />
          )}
        </>
      ) : (
        <>
          <section
            className={cn(
              tutorSurfaceCard,
              "flex flex-wrap items-end gap-4 p-5",
            )}
          >
            <label className="min-w-52 flex-1 text-xs font-medium">
              Interview name
              <input
                aria-label="Interview name"
                className={cn(fieldClass, "mt-2")}
                value={interviewName}
                onChange={(event) => setInterviewName(event.target.value)}
              />
            </label>
            <label className="w-32 text-xs font-medium">
              Reading (minutes)
              <input
                aria-label="Reading minutes"
                type="number"
                min="0"
                step="0.5"
                value={readingMinutes}
                onChange={(event) =>
                  setReadingMinutes(Math.max(0, Number(event.target.value)))
                }
                className={cn(fieldClass, "mt-2")}
              />
            </label>
            <label className="w-32 text-xs font-medium">
              Questions (minutes)
              <input
                aria-label="Question minutes"
                type="number"
                min="0.5"
                step="0.5"
                value={questionMinutes}
                onChange={(event) =>
                  setQuestionMinutes(Math.max(0, Number(event.target.value)))
                }
                className={cn(fieldClass, "mt-2")}
              />
            </label>
            <div className="ml-auto rounded-xl bg-muted/40 px-4 py-2 text-right">
              <div className="text-lg font-semibold">{totalPoints} points</div>
              <div className="text-[10px] text-muted-foreground">
                {stations.length} stations · {placements.length} question
                placements
              </div>
            </div>
          </section>
          {!!repeated.length && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {repeated.length} repeated question
              {repeated.length > 1 ? "s" : ""} in this interview. Students may
              encounter the same question again; this is allowed.
            </div>
          )}
          {variant === "A" ? (
            <AuthoringVariantA navigation={stationRail} main={stationEditor} />
          ) : variant === "B" ? (
            <div className="grid items-start gap-4 2xl:grid-cols-[185px_minmax(0,1fr)_300px] xl:grid-cols-[185px_minmax(0,1fr)]">
              {stationRail}
              {stationEditor}
              <aside
                className={cn(
                  tutorSurfaceCard,
                  "p-4 xl:col-span-2 2xl:col-span-1",
                )}
              >
                <h2 className="mb-4 text-sm font-semibold">Question bank</h2>
                {pickerList}
              </aside>
            </div>
          ) : (
            <AuthoringVariantC overview={board} />
          )}
        </>
      )}
      <div className="text-[11px] text-muted-foreground">
        Throwaway UI · all edits stay in this tab and clear on refresh. No
        backend saves, publishing or PDF export.
      </div>
      <details className="rounded-xl border p-4 text-xs">
        <summary className="cursor-pointer font-medium">
          Prototype state · {variant} / {screen}
        </summary>
        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-[10px]">
          {JSON.stringify(
            {
              variant,
              screen,
              questions,
              categories,
              tags,
              stations,
              interviewName,
              readingMinutes,
              questionMinutes,
              totalPoints,
              selectedStationId,
              interviews,
              selectedInterviewId: selectedInterview.id,
              questionToolbar,
              interviewToolbar,
              searchScopes,
              showArchived,
            },
            null,
            2,
          )}
        </pre>
      </details>
      {screen !== "interviews" && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Chosen layout:{" "}
            {screen === "bank"
              ? "B · list and preview"
              : "A · focused station editor"}
          </span>
          <button
            className="hover:underline"
            onClick={() => {
              const query = new URLSearchParams(params.toString());
              if (comparing) query.delete("compare");
              else {
                query.set("compare", "1");
                query.set("variant", screen === "bank" ? "B" : "A");
              }
              router.replace(
                `/interviews/prototype/authoring?${query.toString()}`,
                { scroll: false },
              );
            }}
          >
            {comparing ? "Return to chosen layout" : "Compare earlier layouts"}
          </button>
        </div>
      )}
      {comparing && screen !== "interviews" && (
        <PrototypeSwitcher variants={variants} />
      )}

      <Dialog
        open={questionDraft !== null}
        onOpenChange={(open) => {
          if (!open) setQuestionDraft(null);
        }}
      >
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[90vh] overflow-y-auto sm:max-w-3xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {questions.some((question) => question.id === questionDraft?.id)
                ? "Edit bank question"
                : "New question"}
            </DialogTitle>
            <DialogDescription>
              Changes update prepared interviews. Active and completed runs
              retain their prompt/question wording; rubric updates also apply to
              active runs.
            </DialogDescription>
          </DialogHeader>
          {questionDraft && (
            <div className="space-y-5">
              <label className="block text-xs font-medium">
                Question
                <textarea
                  aria-label="Question wording"
                  className={cn(fieldClass, "mt-2 min-h-20")}
                  value={questionDraft.question}
                  onChange={(event) =>
                    setQuestionDraft({
                      ...questionDraft,
                      question: event.target.value,
                    })
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
                <label className="text-xs font-medium">
                  Category · choose one
                  <select
                    aria-label="Question category"
                    className={cn(fieldClass, "mt-2")}
                    value={questionDraft.categoryId}
                    onChange={(event) =>
                      setQuestionDraft({
                        ...questionDraft,
                        categoryId: event.target.value,
                      })
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryPath(category)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Suggested seconds
                  <input
                    aria-label="Suggested seconds"
                    type="number"
                    min="0"
                    className={cn(fieldClass, "mt-2")}
                    value={questionDraft.seconds}
                    onChange={(event) =>
                      setQuestionDraft({
                        ...questionDraft,
                        seconds: Math.max(0, Number(event.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <fieldset>
                <legend className="mb-2 text-xs font-medium">
                  Tags · choose any
                </legend>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs",
                        questionDraft.tagIds.includes(tag.id)
                          ? navActiveStyles
                          : "bg-muted/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Tag ${tag.name}`}
                        checked={questionDraft.tagIds.includes(tag.id)}
                        onChange={(event) =>
                          setQuestionDraft({
                            ...questionDraft,
                            tagIds: event.target.checked
                              ? [...questionDraft.tagIds, tag.id]
                              : questionDraft.tagIds.filter(
                                  (id) => id !== tag.id,
                                ),
                          })
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-xs font-medium">
                Reading prompt
                <textarea
                  aria-label="Question reading prompt"
                  className={cn(fieldClass, "mt-2 min-h-28")}
                  value={questionDraft.prompt}
                  onChange={(event) =>
                    setQuestionDraft({
                      ...questionDraft,
                      prompt: event.target.value,
                    })
                  }
                />
                <span className="mt-2 block font-normal text-muted-foreground">
                  Used for reading and printing whenever this is the first
                  question in a station.
                </span>
              </label>
              <label className="block text-xs font-medium">
                Rubric
                <textarea
                  aria-label="Question rubric"
                  className={cn(fieldClass, "mt-2 min-h-28")}
                  value={questionDraft.rubric}
                  onChange={(event) =>
                    setQuestionDraft({
                      ...questionDraft,
                      rubric: event.target.value,
                    })
                  }
                />
              </label>
              <p className="text-[10px] text-muted-foreground">
                Text-only editing in this prototype; rich-text authoring remains
                planned.
              </p>
              <div className="rounded-xl bg-muted/30 p-3 text-xs">
                <strong>
                  Used in {usedAt(questionDraft.id).length} stations across
                  prepared interviews
                </strong>
                <div className="mt-1 text-muted-foreground">
                  {usedAt(questionDraft.id)
                    .map((station) => station.name)
                    .join(" · ") ||
                    "This question has not been added to a station."}
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
                <div>
                  {questions.some(
                    (question) => question.id === questionDraft.id,
                  ) && (
                    <Button
                      variant="ghost"
                      className="gap-2"
                      onClick={() =>
                        archiveQuestion(
                          questionDraft.id,
                          !questionDraft.archived,
                        )
                      }
                    >
                      <Archive size={14} />
                      {questionDraft.archived
                        ? "Restore question"
                        : "Archive question"}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={tutorBtnOutline}
                    onClick={() => setQuestionDraft(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={tutorBtnPrimary}
                    disabled={
                      !questionDraft.question.trim() ||
                      !questionDraft.categoryId
                    }
                    onClick={saveQuestion}
                  >
                    Save question
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[85vh] overflow-y-auto sm:max-w-3xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>Categories & tags</DialogTitle>
            <DialogDescription>
              Each question has one category. Tags are separate and can be
              combined. Edits below apply immediately in this prototype.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Layers3 size={15} />
                Categories
              </h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="rounded-xl bg-muted/30 p-3">
                    <div className="mb-2 text-[10px] text-muted-foreground">
                      {category.group || "General"}
                    </div>
                    <input
                      aria-label={`Category ${category.name}`}
                      className={fieldClass}
                      value={category.name}
                      onChange={(event) =>
                        setCategories(
                          categories.map((item) =>
                            item.id === category.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 rounded-xl border border-dashed p-3">
                <input
                  aria-label="New category group"
                  placeholder="Group, e.g. Personal"
                  value={newGroup}
                  onChange={(event) => setNewGroup(event.target.value)}
                  className={fieldClass}
                />
                <input
                  aria-label="New category name"
                  placeholder="Category name"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  className={fieldClass}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(tutorBtnOutline, "w-full")}
                  disabled={!newCategory.trim()}
                  onClick={() => {
                    setCategories([
                      ...categories,
                      {
                        id: `category-${Date.now()}`,
                        group: newGroup.trim(),
                        name: newCategory.trim(),
                      },
                    ]);
                    setNewCategory("");
                  }}
                >
                  Add category
                </Button>
              </div>
            </section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Tag size={15} />
                Tags
              </h3>
              <div className="space-y-2">
                {tags.map((tag) => (
                  <input
                    key={tag.id}
                    aria-label={`Tag name ${tag.name}`}
                    className={fieldClass}
                    value={tag.name}
                    onChange={(event) =>
                      setTags(
                        tags.map((item) =>
                          item.id === tag.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
              </div>
              <div className="mt-4 space-y-2 rounded-xl border border-dashed p-3">
                <input
                  aria-label="New tag name"
                  placeholder="Tag name"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  className={fieldClass}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(tutorBtnOutline, "w-full")}
                  disabled={!newTag.trim()}
                  onClick={() => {
                    setTags([
                      ...tags,
                      { id: `tag-${Date.now()}`, name: newTag.trim() },
                    ]);
                    setNewTag("");
                  }}
                >
                  Add tag
                </Button>
              </div>
            </section>
          </div>
          <Button className="mt-4" onClick={() => setTaxonomyOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={bankPicker} onOpenChange={setBankPicker}>
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[85vh] overflow-y-auto sm:max-w-2xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>Add questions</DialogTitle>
            <DialogDescription>
              Add bank questions to {selectedStation?.name}. Existing placements
              stay in order.
            </DialogDescription>
          </DialogHeader>
          {pickerList}
          {notice && (
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
          )}
          <Button onClick={() => setBankPicker(false)}>
            Done adding questions
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={stationDialog} onOpenChange={setStationDialog}>
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[90vh] overflow-y-auto sm:max-w-3xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>Edit station</DialogTitle>
            <DialogDescription>
              Question order determines the reading prompt.
            </DialogDescription>
          </DialogHeader>
          {stationEditor}
          <Button
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => setStationDialog(false)}
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={printPreview !== null}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
      >
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[90vh] overflow-y-auto sm:max-w-3xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>Printed prompt preview</DialogTitle>
            <DialogDescription>
              One page per station, using its first question’s prompt. Station
              names and marking guidance are not included. Preview only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 rounded-xl bg-muted/40 p-4">
            {stations
              .filter(
                (station) =>
                  printPreview === "all" || station.id === printPreview,
              )
              .map((station) => (
                <article
                  key={station.id}
                  className="min-h-[480px] bg-white p-10 text-slate-900 shadow-sm"
                >
                  <div className="mb-12 text-xs tracking-wide text-slate-500">
                    {interviewName}
                  </div>
                  <h2 className="mb-8 text-3xl font-semibold">
                    Station {stations.indexOf(station) + 1}
                  </h2>
                  <p className="whitespace-pre-wrap text-lg leading-loose">
                    {getQuestion(station.questionIds[0])?.prompt ||
                      "No prompt available — add a prompt to the first question."}
                  </p>
                  <div className="mt-16 text-xs text-slate-500">
                    Reading time: {readingMinutes} minutes
                  </div>
                </article>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
