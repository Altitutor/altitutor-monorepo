"use client";

// THROWAWAY DEV-284: three session-dialog planning variants on /classes?prototype=lesson-plan&variant=A.
// Memory-only choices explore optional shared preparation; no server writes or student sharing.
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Badge } from "@altitutor/ui";

const catalog = [
  {
    id: "algebra",
    title: "Algebra",
    files: ["Linear equations worksheet", "Algebra revision questions"],
  },
  {
    id: "functions",
    title: "Functions",
    files: ["Graphs and transformations"],
  },
  { id: "calculus", title: "Calculus", files: ["Differentiation practice"] },
];
const variants = ["A", "B", "C"];
const names = ["Inline preparation", "Resource browser", "Teaching agenda"];

export function LessonPlanPrototype() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const enabled = params.get("prototype") === "lesson-plan";
  const variant = params.get("variant") ?? "A";
  const index = Math.max(0, variants.indexOf(variant));
  const [topics, setTopics] = useState(["algebra"]);
  const [files, setFiles] = useState(["Linear equations worksheet"]);
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState("plan");
  const change = (direction: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("variant", variants[(index + direction + 3) % 3]);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,[contenteditable="true"]')
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        change(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!enabled) return null;
  const toggleTopic = (id: string) =>
    setTopics((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  const toggleFile = (file: string) =>
    setFiles((current) =>
      current.includes(file)
        ? current.filter((v) => v !== file)
        : [...current, file],
    );
  const library = (
    <div className="space-y-4">
      {catalog.map((topic) => (
        <div key={topic.id} className="space-y-2">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={topics.includes(topic.id)}
              onChange={() => toggleTopic(topic.id)}
            />
            {topic.title}
          </label>
          {topic.files.map((file) => (
            <label key={file} className="ml-5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={files.includes(file)}
                onChange={() => toggleFile(file)}
              />
              {file}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
  const summary = (
    <div className="space-y-3">
      {topics.map((id) => (
        <Badge key={id} variant="secondary" className="mr-1">
          {catalog.find((t) => t.id === id)?.title}
        </Badge>
      ))}
      {files.map((file) => (
        <div
          key={file}
          className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
        >
          <span>
            {file}
            <small className="block text-muted-foreground">
              Worksheet · Available on teaching iPad
            </small>
          </span>
          <Button size="sm" variant="ghost" onClick={() => toggleFile(file)}>
            Remove
          </Button>
        </div>
      ))}
      {!topics.length && !files.length && (
        <p className="text-sm text-muted-foreground">
          No plan yet. You can still teach and log this session.
        </p>
      )}
    </div>
  );
  return (
    <section className="space-y-4 rounded-xl border border-blue-400/40 p-4 pb-8">
      <div className="space-y-1">
        <Badge variant="outline">
          PROTOTYPE · sample catalog · memory only
        </Badge>
        <h3 className="text-lg font-semibold">Lesson plan</h3>
        <p className="text-sm text-muted-foreground">
          Prepare topics and worksheets for the assigned tutors. Confirm what
          was taught when logging.
        </p>
      </div>
      {variant === "A" && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ready for this session</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPicker(!picker)}
            >
              {picker ? "Done choosing" : "Add topics / files"}
            </Button>
          </div>
          {picker ? library : summary}
        </>
      )}
      {variant === "B" && (
        <>
          <div className="flex gap-2 border-b pb-2">
            <Button
              size="sm"
              variant={tab === "plan" ? "default" : "ghost"}
              onClick={() => setTab("plan")}
            >
              Plan
            </Button>
            <Button
              size="sm"
              variant={tab === "handoff" ? "default" : "ghost"}
              onClick={() => setTab("handoff")}
            >
              iPad handoff
            </Button>
          </div>
          {tab === "plan" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium">Browse topics</h4>
                {library}
              </div>
              <div className="space-y-3 border-l pl-4">
                <h4 className="font-medium">Selected resources</h4>
                {summary}
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-muted p-4 text-sm">
              {files.length} worksheets will be offered when an assigned tutor
              opens this session. Existing iPad annotations stay with that
              tutor.
            </p>
          )}
        </>
      )}
      {variant === "C" && (
        <>
          <ol className="space-y-3">
            {topics.map((id, position) => {
              const topic = catalog.find((t) => t.id === id)!;
              return (
                <li key={id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong>
                      {position + 1}. {topic.title}
                    </strong>
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={position === 0}
                        onClick={() =>
                          setTopics((current) => {
                            const next = [...current];
                            [next[position - 1], next[position]] = [
                              next[position],
                              next[position - 1],
                            ];
                            return next;
                          })
                        }
                      >
                        Move up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleTopic(id)}
                      >
                        Remove topic
                      </Button>
                    </div>
                  </div>
                  {topic.files.map((file) => (
                    <label
                      key={file}
                      className="flex items-center gap-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={files.includes(file)}
                        onChange={() => toggleFile(file)}
                      />
                      {file}
                    </label>
                  ))}
                </li>
              );
            })}
          </ol>
          <Button variant="outline" onClick={() => setPicker(!picker)}>
            Add next topic
          </Button>
          {picker && library}
        </>
      )}
      <details className="text-xs text-muted-foreground">
        <summary>Prototype state</summary>
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(
            {
              variant,
              topics,
              files,
              optional: true,
              studentAccess: "Only after confirmed delivery",
            },
            null,
            2,
          )}
        </pre>
      </details>
      <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-full border bg-foreground px-3 py-2 text-background shadow-xl">
        <button
          type="button"
          aria-label="Previous prototype"
          onClick={() => change(-1)}
        >
          ←
        </button>
        <span className="text-xs">
          {variant} — {names[index]}
        </span>
        <button
          type="button"
          aria-label="Next prototype"
          onClick={() => change(1)}
        >
          →
        </button>
      </div>
    </section>
  );
}
