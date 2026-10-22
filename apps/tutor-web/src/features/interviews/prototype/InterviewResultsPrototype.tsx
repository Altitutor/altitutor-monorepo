"use client";

// DEV-8 THROWAWAY: three tutor/student result layouts on ?screen=results&variant=.
// A table and tabs, B a student workbench/long report, C a station board/cards.
// Releases are copied in-memory snapshots, not database writes or notifications.
import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import {
  ArrowLeft,
  AlertCircle,
  FileCheck2,
  Film,
  LockKeyhole,
  Mic,
  Send,
} from "lucide-react";
import { PrototypeSwitcher } from "@/shared/components/prototype-switcher";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorSurfaceCard,
} from "@/shared/lib/tutor-visual";
import { cn, navActiveStyles } from "@/shared/utils";
import type { PrototypeInterview, PrototypeQuestion } from "./authoring-data";

type StationResult = {
  score: string;
  disposition: "assessed" | "missing" | "not-assessed";
  reason: string;
  feedback: string[];
};
type StudentResult = { id: string; name: string; stations: StationResult[] };
type Release = { version: number; results: StudentResult[] };
const variants = [
  { key: "A", name: "Table & station tabs" },
  { key: "B", name: "Student workbench" },
  { key: "C", name: "Station board" },
];
const fieldClass =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const badgeClass =
  "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground";
const fixtureNames = ["Amelia Chen", "Noah Williams", "Olivia Patel"];
const seed = (interview: PrototypeInterview): StudentResult[] =>
  fixtureNames.map((name, studentIndex) => ({
    id: `result-${studentIndex}`,
    name,
    stations: interview.stations.map((station, index) => ({
      score:
        studentIndex === 2 && index === interview.stations.length - 1
          ? ""
          : String(
              Math.round(station.maximum * (0.7 + studentIndex * 0.1) * 10) /
                10,
            ),
      disposition:
        studentIndex === 2 && index === interview.stations.length - 1
          ? "missing"
          : "assessed",
      reason: "",
      feedback: station.questionIds.map((_, questionIndex) =>
        studentIndex === 2 && index === interview.stations.length - 1
          ? ""
          : questionIndex === 0
            ? "You gave a clear, structured answer and considered the other person’s perspective. Be more specific about your next step."
            : "Good reflection. Support your conclusion with one concrete example.",
      ),
    })),
  }));
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(tutorSurfaceCard, "space-y-4 p-5")}>
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function releasedExample(interview: PrototypeInterview): StudentResult[] {
  return seed(interview).map((result) => ({
    ...result,
    stations: result.stations.map((station) =>
      station.disposition === "missing"
        ? {
            ...station,
            disposition: "not-assessed",
            reason:
              "Connection failure prevented assessment; this station is excluded by agreement.",
          }
        : station,
    ),
  }));
}
export function ResultsVariantA({
  overview,
  detail,
}: {
  overview: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="space-y-6">
      {overview}
      {detail}
    </div>
  );
}
export function ResultsVariantB({
  navigation,
  detail,
}: {
  navigation: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside>{navigation}</aside>
      <div className="min-w-0">{detail}</div>
    </div>
  );
}
export function ResultsVariantC({ board }: { board: ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {board}
    </div>
  );
}

export function InterviewResultsPrototype({
  interview,
  questions,
  onBack,
}: {
  interview: PrototypeInterview;
  questions: PrototypeQuestion[];
  onBack: () => void;
}) {
  const params = useSearchParams();
  const variant = ["A", "B", "C"].includes(params.get("variant") ?? "")
    ? params.get("variant")
    : "A";
  const [results, setResults] = useState(() =>
    params.get("sample") === "released"
      ? releasedExample(interview)
      : seed(interview),
  );
  const [release, setRelease] = useState<Release | null>(() =>
    params.get("sample") === "released"
      ? { version: 1, results: structuredClone(results) }
      : null,
  );
  const [audience, setAudience] = useState<"tutor" | "student">("tutor");
  const [studentId, setStudentId] = useState("result-2");
  const [stationIndex, setStationIndex] = useState(0);
  const [dialog, setDialog] = useState<
    "release" | "editor" | "recording" | null
  >(null);
  const [enrolled, setEnrolled] = useState(true);
  const [recordingState, setRecordingState] = useState<
    "available" | "processing" | "failed" | "expired" | "off"
  >("available");
  const [delivery, setDelivery] = useState<"online" | "in-person">("online");
  const [notice, setNotice] = useState("");
  const current =
    results.find((result) => result.id === studentId) ?? results[0];
  const published = release?.results.find((result) => result.id === studentId);
  const activeStation =
    interview.stations[stationIndex] ?? interview.stations[0];
  const assessment = current.stations[stationIndex];
  const hasChanges =
    release !== null &&
    JSON.stringify(release.results) !== JSON.stringify(results);
  const stationReady = (result: StationResult, index: number) =>
    result.disposition === "not-assessed"
      ? result.reason.trim().length > 0
      : result.disposition === "assessed" &&
        result.score.trim() !== "" &&
        Number.isFinite(Number(result.score)) &&
        Number(result.score) >= 0 &&
        Number(result.score) <= interview.stations[index].maximum;
  const ready = (result: StudentResult) =>
    result.stations.length > 0 && result.stations.every(stationReady);
  const readyCount = results.filter(ready).length;
  const canRelease = readyCount === results.length && (!release || hasChanges);
  const total = (result: StudentResult) => {
    const assessed = result.stations.flatMap((station, index) =>
      station.disposition === "assessed" && stationReady(station, index)
        ? [
            {
              earned: Number(station.score),
              possible: interview.stations[index].maximum,
            },
          ]
        : [],
    );
    return {
      earned:
        Math.round(
          assessed.reduce((sum, station) => sum + station.earned, 0) * 100,
        ) / 100,
      possible:
        Math.round(
          assessed.reduce((sum, station) => sum + station.possible, 0) * 100,
        ) / 100,
      partial: result.stations.some(
        (station) => station.disposition === "not-assessed",
      ),
    };
  };
  const scoreText = (result: StudentResult) => {
    const score = total(result);
    return score.possible === 0
      ? "No assessed stations"
      : `${score.earned} / ${score.possible}`;
  };
  const updateStation = (patch: Partial<StationResult>) =>
    setResults((all) =>
      all.map((result) =>
        result.id === studentId
          ? {
              ...result,
              stations: result.stations.map((station, i) =>
                i === stationIndex ? { ...station, ...patch } : station,
              ),
            }
          : result,
      ),
    );
  const selectResult = (id: string, index = 0) => {
    setStudentId(id);
    setStationIndex(index);
  };
  const publish = () => {
    if (!canRelease) return;
    setRelease({
      version: (release?.version ?? 0) + 1,
      results: structuredClone(results),
    });
    setNotice(
      release
        ? "Updated results released in this prototype."
        : "Results released in this prototype. Students can now see scores, feedback and available recordings.",
    );
    setDialog(null);
  };

  const recordingCard = (notAssessed: boolean) => (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {delivery === "online" ? <Film size={20} /> : <Mic size={20} />}
          <div>
            <p className="text-sm font-medium">
              {delivery === "online" ? "Station video" : "Station audio"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {notAssessed
                ? "No recording for this station"
                : recordingState === "available"
                  ? "Available · expires 21 Jan 2027"
                  : recordingState === "processing"
                    ? "Processing — check back later"
                    : recordingState === "expired"
                      ? "Expired after 90 days"
                      : recordingState === "off"
                        ? "Recording was off for this round"
                        : "Recording failed — written feedback is still available"}
            </p>
          </div>
        </div>
        {!notAssessed && recordingState === "available" && (
          <Button
            variant="outline"
            size="sm"
            className={tutorBtnOutline}
            onClick={() => setDialog("recording")}
          >
            Preview recording
          </Button>
        )}
      </div>
    </div>
  );

  const stationTabs = (
    <div className="flex flex-wrap gap-2">
      {interview.stations.map((station, index) => (
        <button
          key={station.id}
          aria-pressed={stationIndex === index}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm",
            stationIndex === index ? navActiveStyles : "text-muted-foreground",
          )}
          onClick={() => setStationIndex(index)}
        >
          Station {index + 1}
          {audience === "tutor" &&
            !stationReady(current.stations[index], index) && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                Needs attention
              </span>
            )}
        </button>
      ))}
    </div>
  );
  const editor =
    activeStation && assessment ? (
      <Card title={`${current.name} · Station ${stationIndex + 1}`}>
        <p className="text-xs text-muted-foreground">
          {activeStation.name} ·{" "}
          {release
            ? hasChanges
              ? "Draft correction — students keep seeing the previous release."
              : "Released. Any changes you make stay draft until you release an update."
            : "Unreleased — only tutors can see these notes."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-medium">
            Outcome
            <select
              aria-label="Station outcome"
              className={fieldClass}
              value={assessment.disposition}
              onChange={(event) =>
                updateStation({
                  disposition: event.target
                    .value as StationResult["disposition"],
                })
              }
            >
              <option value="assessed">Assessed</option>
              <option value="missing">Not completed / awaiting retry</option>
              <option value="not-assessed">
                Not assessed — agreed exception
              </option>
            </select>
          </label>
          {assessment.disposition === "assessed" && (
            <label className="space-y-2 text-xs font-medium">
              Overall score / {activeStation.maximum}
              <input
                aria-label="Overall station score"
                type="number"
                min={0}
                max={activeStation.maximum}
                step="any"
                value={assessment.score}
                className={fieldClass}
                onChange={(event) =>
                  updateStation({ score: event.target.value })
                }
              />
            </label>
          )}
        </div>
        {assessment.disposition === "missing" && (
          <div className="rounded-xl bg-muted/40 p-4 text-sm">
            This station is unresolved and blocks release. Enter a score after
            assessment/retry, or agree an exception with a reason. A missing
            score is never automatically zero.
          </div>
        )}
        {assessment.disposition === "not-assessed" && (
          <div className="space-y-3">
            <label className="block space-y-2 text-xs font-medium">
              Reason (required; visible to student)
              <textarea
                aria-label="Reason for not assessed"
                rows={2}
                className={fieldClass}
                value={assessment.reason}
                onChange={(event) =>
                  updateStation({ reason: event.target.value })
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Excluded from possible points. This student’s result will be
              labelled partial.
            </p>
          </div>
        )}
        {assessment.disposition === "assessed" &&
          !stationReady(assessment, stationIndex) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Enter a score from 0 to {activeStation.maximum}; decimals are
              allowed.
            </p>
          )}
        {assessment.disposition !== "not-assessed" && (
          <div className="space-y-5 border-t pt-4">
            {activeStation.questionIds.map((id, i) => (
              <label key={`${id}-${i}`} className="block space-y-2">
                <span className="text-xs text-muted-foreground">
                  Question {i + 1}
                </span>
                <span className="block text-sm font-medium">
                  {questions.find((question) => question.id === id)?.question ??
                    "Question"}
                </span>
                <textarea
                  aria-label={`Feedback for question ${i + 1}`}
                  rows={3}
                  className={fieldClass}
                  value={assessment.feedback[i] ?? ""}
                  onChange={(event) =>
                    updateStation({
                      feedback: assessment.feedback.map(
                        (text, questionIndex) =>
                          questionIndex === i ? event.target.value : text,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
        {recordingCard(assessment.disposition === "not-assessed")}
        <p className="text-xs text-muted-foreground">
          Draft changes stay in this prototype until refresh.{" "}
          {stationReady(assessment, stationIndex)
            ? "This station is ready for release."
            : "This station needs attention before release."}
        </p>
      </Card>
    ) : (
      <p>No stations in this interview.</p>
    );

  const overview = (
    <div className={cn(tutorSurfaceCard, "overflow-x-auto")}>
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="p-4 font-medium">Student</th>
            {interview.stations.map((station, i) => (
              <th key={station.id} className="p-4 font-medium">
                Station {i + 1}
              </th>
            ))}
            <th className="p-4 font-medium">Total</th>
            <th className="p-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr
              key={result.id}
              className={cn(
                "border-t",
                result.id === studentId && navActiveStyles,
              )}
            >
              <td className="p-4">
                <button
                  className="font-medium hover:underline"
                  onClick={() => selectResult(result.id)}
                >
                  {result.name}
                </button>
              </td>
              {result.stations.map((station, i) => (
                <td key={i} className="p-4">
                  <button
                    className={cn(
                      "hover:underline",
                      !stationReady(station, i) &&
                        "text-amber-600 dark:text-amber-400",
                    )}
                    onClick={() => selectResult(result.id, i)}
                  >
                    {station.disposition === "not-assessed"
                      ? "Not assessed"
                      : stationReady(station, i)
                        ? `${station.score} / ${interview.stations[i].maximum}`
                        : "Needs marking"}
                  </button>
                </td>
              ))}
              <td className="p-4">
                <span className="font-medium">
                  {ready(result) ? scoreText(result) : "Incomplete"}
                </span>
                {total(result).partial && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Partial result
                  </span>
                )}
              </td>
              <td className="p-4">
                <span className={badgeClass}>
                  {ready(result) ? "Ready" : "Needs attention"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const navigation = (
    <Card title="Students">
      {results.map((result) => (
        <button
          key={result.id}
          className={cn(
            "w-full rounded-xl p-3 text-left",
            result.id === studentId ? navActiveStyles : "hover:bg-muted/30",
          )}
          onClick={() => selectResult(result.id)}
        >
          <span className="block text-sm font-medium">{result.name}</span>
          <span className="mt-2 block text-xs text-muted-foreground">
            {ready(result) ? scoreText(result) : "Needs attention"}
            {total(result).partial ? " · Partial" : ""}
          </span>
        </button>
      ))}
    </Card>
  );
  const board = interview.stations.map((station, index) => (
    <Card key={station.id} title={`Station ${index + 1}`}>
      <p className="text-xs text-muted-foreground">
        {station.name} · {station.maximum} points
      </p>
      <div className="divide-y">
        {results.map((result) => (
          <button
            key={result.id}
            className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm"
            onClick={() => {
              selectResult(result.id, index);
              setDialog("editor");
            }}
          >
            <span>{result.name}</span>
            <span
              className={cn(
                badgeClass,
                !stationReady(result.stations[index], index) &&
                  "text-amber-600 dark:text-amber-400",
              )}
            >
              {result.stations[index].disposition === "not-assessed"
                ? "Not assessed"
                : stationReady(result.stations[index], index)
                  ? result.stations[index].score
                  : "Needs marking"}
            </span>
          </button>
        ))}
      </div>
    </Card>
  ));

  const studentStation = (index: number) => {
    const station = interview.stations[index];
    const result = published?.stations[index];
    if (!station || !result) return null;
    return (
      <Card key={station.id} title={`Station ${index + 1}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={badgeClass}>
            {result.disposition === "not-assessed"
              ? "Not assessed"
              : `${result.score} / ${station.maximum} points`}
          </span>
          <span className="text-xs text-muted-foreground">
            {result.disposition === "not-assessed"
              ? "Excluded from your total"
              : "Overall station score"}
          </span>
        </div>
        {result.disposition === "not-assessed" ? (
          <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
            {result.reason}
          </div>
        ) : (
          <div className="space-y-5">
            {station.questionIds.map((id, i) => (
              <div key={`${id}-${i}`} className="space-y-2 border-t pt-4">
                <div className="text-xs text-muted-foreground">
                  Question {i + 1}
                </div>
                <h3 className="text-sm font-medium">
                  {questions.find((question) => question.id === id)?.question ??
                    "Question"}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {result.feedback[i] ||
                    "No written feedback for this question."}
                </p>
              </div>
            ))}
          </div>
        )}
        {recordingCard(result.disposition === "not-assessed")}
      </Card>
    );
  };
  const studentSummary = published ? (
    <div
      className={cn(
        tutorSurfaceCard,
        "flex flex-wrap items-center justify-between gap-5 p-6",
      )}
    >
      <div>
        <div className="text-xs text-muted-foreground">Your result</div>
        <p className="mt-2 text-3xl font-semibold">{scoreText(published)}</p>
        {total(published).partial && (
          <p className="mt-2 text-sm text-muted-foreground">
            Partial result · not-assessed stations are excluded.
          </p>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <p>Released · version {release?.version}</p>
        <p className="mt-2">{interview.stations.length} stations</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6 pb-28">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 gap-2 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft size={14} />
        Back to interview
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs text-muted-foreground">
            Medicine interviews · Results prototype
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {interview.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed round · 23 October 2026 ·{" "}
            {audience === "tutor" ? `${results.length} students` : current.name}
          </p>
        </div>
        {audience === "tutor" && (
          <Button
            className={cn(tutorBtnPrimary, "gap-2")}
            disabled={!canRelease}
            onClick={() => setDialog("release")}
          >
            <Send size={15} />
            {release ? "Release updated results" : "Release results"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex gap-2">
          {(["tutor", "student"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={audience === value}
              className={cn(
                "rounded-xl px-4 py-2 text-sm",
                audience === value ? navActiveStyles : "text-muted-foreground",
              )}
              onClick={() => setAudience(value)}
            >
              {value === "tutor" ? "Tutor review" : "Student preview"}
            </button>
          ))}
        </div>
        {audience === "student" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Preview as
            <select
              aria-label="Preview student"
              className={cn(fieldClass, "w-auto")}
              value={studentId}
              onChange={(event) => selectResult(event.target.value)}
            >
              {results.map((result) => (
                <option key={result.id} value={result.id}>
                  {result.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {notice && audience === "tutor" && (
        <p role="status" className="rounded-xl bg-muted/40 p-4 text-sm">
          {notice}
        </p>
      )}
      {audience === "tutor" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              {readyCount === results.length ? (
                <FileCheck2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <div>
                <p className="text-sm font-medium">
                  {readyCount} of {results.length} student results ready
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {release
                    ? hasChanges
                      ? "Draft corrections are hidden from students until you release the update."
                      : "Students can see the current release."
                    : "Resolve every missing score or agreed exception before releasing the whole round."}
                </p>
              </div>
            </div>
            <span className={badgeClass}>
              {release
                ? hasChanges
                  ? "Unreleased corrections"
                  : `Released · v${release.version}`
                : "Not released"}
            </span>
          </div>
          {variant === "A" && (
            <ResultsVariantA
              overview={overview}
              detail={
                <div className="space-y-4">
                  {stationTabs}
                  {editor}
                </div>
              }
            />
          )}
          {variant === "B" && (
            <ResultsVariantB
              navigation={navigation}
              detail={
                <div className="space-y-4">
                  {stationTabs}
                  {editor}
                </div>
              }
            />
          )}
          {variant === "C" && <ResultsVariantC board={board} />}
        </>
      ) : !enrolled ? (
        <Card title="Interview access has ended">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <LockKeyhole size={20} />
            <p>
              Interview enrolment is required to view past results and
              recordings.
            </p>
          </div>
        </Card>
      ) : !published ? (
        <Card title="Your feedback is being prepared">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <LockKeyhole size={20} />
            <p>
              Your tutor will release your scores, written feedback and
              recordings together.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {studentSummary}
          {variant === "A" && (
            <>
              {stationTabs}
              {studentStation(stationIndex)}
            </>
          )}
          {variant === "B" && (
            <div className="space-y-5">
              {interview.stations.map((_, i) => studentStation(i))}
            </div>
          )}
          {variant === "C" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {published.stations.map((station, i) => (
                  <button
                    key={i}
                    aria-pressed={stationIndex === i}
                    onClick={() => setStationIndex(i)}
                    className={cn(
                      tutorSurfaceCard,
                      "space-y-3 p-5 text-left",
                      stationIndex === i && navActiveStyles,
                    )}
                  >
                    <p className="text-sm font-medium">Station {i + 1}</p>
                    <p className="text-xl font-semibold">
                      {station.disposition === "not-assessed"
                        ? "Not assessed"
                        : `${station.score} / ${interview.stations[i].maximum}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      View feedback →
                    </p>
                  </button>
                ))}
              </div>
              {studentStation(stationIndex)}
            </>
          )}
        </div>
      )}

      <details className={cn(tutorSurfaceCard, "p-4 text-xs")}>
        <summary className="cursor-pointer font-medium">
          Prototype controls & state · {variant}
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground">
            Mock results only. No real release, recording playback or backend
            save. Leaving this screen or refreshing resets everything.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="sm"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => {
                const example = releasedExample(interview);
                setResults(example);
                setRelease({ version: 1, results: structuredClone(example) });
                setNotice("");
                setEnrolled(true);
              }}
            >
              Load released example
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => {
                setResults(seed(interview));
                setRelease(null);
                setNotice("");
                setEnrolled(true);
              }}
            >
              Reset unreleased example
            </Button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enrolled}
                onChange={(event) => setEnrolled(event.target.checked)}
              />
              Student is currently enrolled
            </label>
            <label className="flex items-center gap-2">
              Recording state
              <select
                aria-label="Simulated recording state"
                className={cn(fieldClass, "w-auto")}
                value={recordingState}
                onChange={(event) =>
                  setRecordingState(event.target.value as typeof recordingState)
                }
              >
                <option value="available">Available</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="off">Recording off</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Delivery
              <select
                aria-label="Simulated delivery"
                className={cn(fieldClass, "w-auto")}
                value={delivery}
                onChange={(event) =>
                  setDelivery(
                    event.target.value === "online" ? "online" : "in-person",
                  )
                }
              >
                <option value="online">Online video</option>
                <option value="in-person">In-person audio</option>
              </select>
            </label>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl bg-muted/40 p-3">
            {JSON.stringify(
              audience === "tutor"
                ? {
                    variant,
                    audience,
                    results,
                    release,
                    hasChanges,
                    readyCount,
                  }
                : {
                    variant,
                    audience,
                    enrolled,
                    publishedVersion: release?.version ?? null,
                    recordingState,
                  },
              null,
              2,
            )}
          </pre>
        </div>
      </details>
      <PrototypeSwitcher variants={variants} defaultVariant="A" />

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[85vh] overflow-auto",
            dialog === "editor" ? "sm:max-w-3xl" : "sm:max-w-xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === "release"
                ? release
                  ? "Release corrected results?"
                  : "Release this round’s results?"
                : dialog === "recording"
                  ? "Station recording"
                  : "Review station result"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "release"
                ? "Selected students with current interview enrolment will see this version of their scores, written feedback and available recordings."
                : dialog === "recording"
                  ? "Illustrative player layout — no recording is loaded in this prototype."
                  : "Scores and notes remain draft until the round is explicitly released."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "release" ? (
            <div className="space-y-5">
              <div className="divide-y">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span>{result.name}</span>
                    <span>
                      {scoreText(result)}
                      {total(result).partial ? " · Partial" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  onClick={() => setDialog(null)}
                >
                  Keep reviewing
                </Button>
                <Button
                  disabled={!canRelease}
                  className={tutorBtnPrimary}
                  onClick={publish}
                >
                  Confirm release
                </Button>
              </div>
            </div>
          ) : dialog === "editor" ? (
            editor
          ) : (
            <div className="space-y-4">
              <div className="flex aspect-video items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                {delivery === "online" ? <Film size={40} /> : <Mic size={40} />}
              </div>
              <div className="h-1 rounded bg-muted" />
              <p className="text-xs text-muted-foreground">
                0:00 / 8:00 ·{" "}
                {delivery === "online" ? "Modest-quality video" : "Audio only"}{" "}
                · expires 21 Jan 2027
              </p>
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => setDialog(null)}
              >
                Close preview
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
