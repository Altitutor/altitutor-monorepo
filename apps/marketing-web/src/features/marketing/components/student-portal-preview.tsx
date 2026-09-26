"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { AnimatedHamburgerIcon } from "@altitutor/ui";
import {
  BookOpen,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Edit3,
  Home,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import portalStyles from "./student-portal-preview.module.css";

const STUDENT_CANVAS_WIDTH = 1040;
const STUDENT_CANVAS_HEIGHT = 680;
const STUDENT_FG = "text-[hsl(212_86%_14%)]";
const STUDENT_MUTED = "text-[hsl(212_86%_25%)]";
const STUDENT_CARD =
  "rounded-2xl bg-white text-[hsl(212_86%_14%)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.06]";

const NOTE_PAGES = [
  "/images/marketing/12biol-dna/page-1.jpg",
  "/images/marketing/12biol-dna/page-2.jpg",
  "/images/marketing/12biol-dna/page-3.jpg",
  "/images/marketing/12biol-dna/page-4.jpg",
] as const;

const SIDEBAR_SUBJECTS = [
  "SACE 12 Biology",
  "SACE 12 Chemistry",
  "SACE 12 Mathematical Methods",
  "SACE 12 Physics",
] as const;

type TopicNode = {
  code: string;
  name: string;
  files: number;
  children?: readonly TopicNode[];
};

/** SACE 12 Biology topic tree and file counts from production. */
const BIOLOGY_TOPICS: readonly TopicNode[] = [
  {
    code: "1",
    name: "DNA and Proteins",
    files: 15,
    children: [
      { code: "1.1", name: "DNA structure and replication", files: 5 },
      { code: "1.2", name: "Protein Synthesis", files: 5 },
      { code: "1.3", name: "Protein Structure and Function", files: 5 },
      { code: "1.4", name: "Genetic Expression and Mutations", files: 5 },
      { code: "1.5", name: "Biotechnology", files: 5 },
    ],
  },
  {
    code: "2",
    name: "Cells as the Basis of Life",
    files: 13,
    children: [
      { code: "2.1", name: "Cells", files: 5 },
      { code: "2.2", name: "Energy", files: 5 },
      { code: "2.3", name: "Cellular Transport", files: 5 },
      { code: "2.4", name: "Cell Metabolism", files: 5 },
      { code: "2.5", name: "Cell Division", files: 5 },
      { code: "2.6", name: "Control of the Cell Cycle", files: 5 },
    ],
  },
  {
    code: "3",
    name: "Homeostasis",
    files: 8,
    children: [
      { code: "3.1", name: "Nervous and Endocrine Systems", files: 5 },
      { code: "3.2", name: "Temperature and Regulation", files: 5 },
      { code: "3.3", name: "Osmoregulation", files: 5 },
      { code: "3.4", name: "Carbon Dioxide regulation", files: 5 },
      { code: "3.5", name: "Blood Glucose Regulation", files: 4 },
      { code: "3.6", name: "Fight or Flight Response", files: 4 },
    ],
  },
  {
    code: "4",
    name: "Evolution",
    files: 7,
    children: [
      { code: "4.1", name: "Origin of Life and Comparative Genomics", files: 7 },
      { code: "4.2", name: "Species and Natural Selection", files: 7 },
      { code: "4.3", name: "Speciation, Succession, Human Impact", files: 7 },
    ],
  },
  { code: "5", name: "Altitutor and SACE Exams", files: 64 },
  {
    code: "6",
    name: "Practical Report Exemplars",
    files: 0,
    children: [
      { code: "6.1", name: "Practical Reports", files: 16 },
      { code: "6.2", name: "Design and Deconstructs", files: 15 },
      { code: "6.3", name: "SHE Tasks", files: 30 },
    ],
  },
];

const TOPIC_ONE_TESTS = [
  ["1T.1", "1T.1 DNA and Proteins", "1T.1_SOL", "1T.1 DNA and Proteins SOL"],
  ["1T.2", "1T.2 DNA and Proteins", "1T.2_SOL", "1T.2 DNA and Proteins SOL"],
  ["1T.3", "1T.3 DNA and Proteins", "1T.3_SOL", "1T.3 DNA and Proteins SOL"],
  ["1T.4", "1T.4 DNA and Proteins", "1T.4_SOL", "1T.4 DNA and Proteins SOL"],
  ["1T.5", "1T.5 DNA and Proteins", "1T.5_SOL", "1T.5 DNA and Proteins SOL"],
  ["1T.6", "1T.6 DNA and Proteins", "1T.6_SOL", "1T.6 DNA and Proteins SOL"],
  ["1T.7", "1T.7 DNA and Proteins", "1T.7_SOL", "1T.7 DNA and Protein SOL"],
] as const;

function countLabel(topic: TopicNode) {
  const parts: string[] = [];
  const subtopics = topic.children?.length ?? 0;
  if (subtopics > 0) {
    parts.push(`${subtopics} ${subtopics === 1 ? "subtopic" : "subtopics"}`);
  }
  if (topic.files > 0) {
    parts.push(`${topic.files} ${topic.files === 1 ? "file" : "files"}`);
  }
  return parts.join(" · ");
}

function PortalCursor({ className }: { className: string }) {
  return (
    <span className={`${portalStyles.cursor} ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 3l14 8.5-6.2 1.6L10.2 21 5 3z"
          fill="rgb(var(--marketing-primary))"
          stroke="#fff"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      <span className={portalStyles.ripple} />
    </span>
  );
}

function StudentShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full gap-3 bg-[hsl(220_14%_96%)] p-3 font-marketing-body">
      <aside className="flex w-[250px] shrink-0 flex-col rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-black/[0.06]">
        <div className="flex h-14 shrink-0 items-center gap-2 px-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl">
            <AnimatedHamburgerIcon isOpen />
          </span>
          <p className={`truncate text-lg font-semibold ${STUDENT_FG}`}>Altitutor Student</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-2">
          <SidebarLink icon={Home} label="Dashboard" />
          <SidebarLink icon={Calendar} label="Classes" />
          <div className="flex items-center gap-1 rounded-xl bg-[hsl(220_12%_92%)] px-2 py-2 text-sm font-medium">
            <span className="flex min-w-0 flex-1 items-center gap-3 px-1">
              <BookOpen className="size-5 shrink-0" />
              <span>Resources</span>
            </span>
            <ChevronDown className="size-4 shrink-0" />
          </div>
          <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-black/[0.08] pl-3">
            {SIDEBAR_SUBJECTS.map((subject) => {
              const active = subject === "SACE 12 Biology";
              return (
                <div
                  key={subject}
                  className={`flex items-center gap-2 overflow-hidden rounded-xl px-2 py-1.5 text-sm whitespace-nowrap ${
                    active ? "bg-[hsl(220_12%_92%)] font-medium" : STUDENT_MUTED
                  }`}
                >
                  <BookOpen className="size-4 shrink-0 opacity-80" />
                  <span className="truncate">{subject}</span>
                </div>
              );
            })}
          </div>
          <SidebarLink icon={Brain} label="Flashcards" />
          <div className={`flex items-center gap-1 rounded-xl px-2 py-2 text-sm ${STUDENT_FG}`}>
            <span className="flex min-w-0 flex-1 items-center gap-3 px-1">
              <CreditCard className="size-5 shrink-0" />
              <span>Billing</span>
            </span>
            <ChevronDown className="size-4 shrink-0 -rotate-90" />
          </div>
        </nav>
        <nav className="mt-auto shrink-0 p-2">
          <SidebarLink icon={Settings} label="Settings" />
        </nav>
      </aside>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-white/45 ring-1 ring-black/[0.04]">
        {children}
      </div>
    </div>
  );
}

function SidebarLink({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${STUDENT_FG}`}>
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function TopicRows({ nodes, depth = 0 }: { nodes: readonly TopicNode[]; depth?: number }) {
  return (
    <ul className={depth > 0 ? "pl-3" : undefined}>
      {nodes.map((topic) => {
        const isTopicOne = depth === 0 && topic.code === "1";
        return (
          <li key={topic.code}>
            <div
              className={`flex items-center gap-1 rounded-lg py-0.5 pr-1 ${
                isTopicOne ? portalStyles.pressTopic : ""
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                <ChevronRight
                  className={`size-3.5 ${topic.children?.length ? "rotate-90" : "opacity-0"}`}
                />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium">
                <span className="min-w-0 flex-1 truncate">
                  {topic.code} · {topic.name}
                </span>
                <span className={`shrink-0 text-xs font-medium ${STUDENT_MUTED}`}>
                  {countLabel(topic)}
                </span>
              </span>
              {isTopicOne ? <PortalCursor className={portalStyles.cursorTopic} /> : null}
            </div>
            {topic.children?.length ? (
              <TopicRows nodes={topic.children} depth={depth + 1} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function FileCard({
  label,
  icon: Icon,
  accent,
  solution = false,
  press = false,
}: {
  label: string;
  icon: LucideIcon;
  accent: string;
  solution?: boolean;
  press?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.06] ${
        press ? portalStyles.pressFile : ""
      }`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        {solution ? (
          <span className={`block text-[10px] font-semibold uppercase tracking-wide ${STUDENT_MUTED}`}>
            Solution
          </span>
        ) : null}
        <span className="block truncate text-sm font-medium leading-snug">{label}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-40" />
      {press ? <PortalCursor className={portalStyles.cursorFile} /> : null}
    </div>
  );
}

function Breadcrumb({ crumbs }: { crumbs: readonly string[] }) {
  return (
    <nav className={`mb-3 flex items-center gap-2 overflow-hidden text-sm whitespace-nowrap ${STUDENT_MUTED}`}>
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb} className="flex min-w-0 items-center gap-2">
            {index > 0 ? <ChevronRight className="size-4 shrink-0" /> : null}
            <span className={last ? `truncate font-medium ${STUDENT_FG}` : "truncate"}>{crumb}</span>
          </span>
        );
      })}
    </nav>
  );
}

function SubjectScene() {
  return (
    <div className="h-full overflow-hidden px-6 py-6">
      <p className={`text-3xl font-bold tracking-tight ${STUDENT_FG}`}>SACE 12 Biology</p>
      <p className={`mt-1 text-sm ${STUDENT_MUTED}`}>
        Browse the full topic hierarchy for this subject.
      </p>
      <section className={`${STUDENT_CARD} mt-6 p-5`}>
        <p className={`mb-3 text-2xl font-semibold ${STUDENT_FG}`}>Topics</p>
        <TopicRows nodes={BIOLOGY_TOPICS} />
      </section>
    </div>
  );
}

function TopicScene() {
  const subtopics = BIOLOGY_TOPICS[0]?.children ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-6">
      <Breadcrumb crumbs={["Resources", "SACE 12 Biology", "Topic 1 · DNA and Proteins"]} />
      <p className={`text-2xl font-bold tracking-tight ${STUDENT_FG}`}>
        Topic 1 · DNA and Proteins
      </p>
      <div className={`${portalStyles.scrollport} mt-5 min-h-0 flex-1`}>
        <div className={portalStyles.topicDrift}>
          <p className={`mb-3 text-xl font-semibold ${STUDENT_FG}`}>Test</p>
          <div className="space-y-2">
            {TOPIC_ONE_TESTS.map(([code, name, solutionCode, solutionName]) => (
              <div key={code} className="space-y-2">
                <FileCard
                  label={`${code} · ${name}`}
                  icon={ClipboardList}
                  accent="bg-violet-500/10 text-violet-700"
                />
                <FileCard
                  label={`${solutionCode} · ${solutionName}`}
                  icon={ClipboardList}
                  accent="bg-violet-500/10 text-violet-700"
                  solution
                />
              </div>
            ))}
          </div>
          <p className={`mt-6 mb-3 text-xl font-semibold ${STUDENT_FG}`}>Revision Sheet</p>
          <FileCard
            label="1RS.1 · 1S DNA and proteins"
            icon={ScrollText}
            accent="bg-teal-500/10 text-teal-700"
          />
          <p className={`mt-6 mb-3 text-xl font-semibold ${STUDENT_FG}`}>Subtopics</p>
          <ul>
            {subtopics.map((topic) => {
              const isNotesTopic = topic.code === "1.1";
              return (
                <li
                  key={topic.code}
                  className={`flex items-center gap-1 rounded-lg py-0.5 pr-1 ${
                    isNotesTopic ? portalStyles.pressSubtopic : ""
                  }`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center">
                    <ChevronRight className="size-3.5 opacity-0" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium">
                    <span className="min-w-0 flex-1 truncate">
                      {topic.code} · {topic.name}
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${STUDENT_MUTED}`}>
                      {countLabel(topic)}
                    </span>
                  </span>
                  {isNotesTopic ? (
                    <PortalCursor className={portalStyles.cursorSubtopic} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FilesScene() {
  return (
    <div className="h-full overflow-hidden px-6 py-6">
      <Breadcrumb
        crumbs={[
          "Resources",
          "SACE 12 Biology",
          "Topic 1.1 · DNA structure and replication",
        ]}
      />
      <p className={`text-2xl font-bold tracking-tight ${STUDENT_FG}`}>
        Topic 1.1 · DNA structure and replication
      </p>
      <div className="mt-5 space-y-6">
        <div>
          <p className={`mb-3 text-xl font-semibold ${STUDENT_FG}`}>Notes</p>
          <div className="space-y-2">
            <FileCard
              label="1.1N.1 · 1.1N DNA structure and replication STUDENT"
              icon={BookOpen}
              accent="bg-emerald-500/10 text-emerald-700"
              press
            />
            <FileCard
              label="1.1N.1_SOL · 1.1N DNA structure and replication"
              icon={BookOpen}
              accent="bg-emerald-500/10 text-emerald-700"
              solution
            />
          </div>
        </div>
        <div>
          <p className={`mb-3 text-xl font-semibold ${STUDENT_FG}`}>Practice Questions</p>
          <div className="space-y-2">
            <FileCard
              label="1.1PQ.1 · 1.1PQ DNA structure and replication"
              icon={Edit3}
              accent="bg-sky-500/10 text-sky-700"
            />
            <FileCard
              label="1.1PQ.1_SOL · 1.1PQ DNA structure and replication SOL"
              icon={Edit3}
              accent="bg-sky-500/10 text-sky-700"
              solution
            />
          </div>
        </div>
        <div>
          <p className={`mb-3 text-xl font-semibold ${STUDENT_FG}`}>Revision Sheet</p>
          <FileCard
            label="1.1RS.1 · 1.1Q DNA structure and replication QUESTIONS"
            icon={ScrollText}
            accent="bg-teal-500/10 text-teal-700"
          />
        </div>
      </div>
    </div>
  );
}

function NotesScene() {
  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-6">
      <Breadcrumb
        crumbs={[
          "Resources",
          "SACE 12 Biology",
          "Topic 1.1 · DNA structure and replication",
          "1.1N.1",
        ]}
      />
      <p className={`truncate text-2xl font-bold tracking-tight ${STUDENT_FG}`}>
        1.1N.1 DNA structure and replication Notes
      </p>
      <p className={`mt-1 truncate text-sm ${STUDENT_MUTED}`}>
        1.1N DNA structure and replication STUDENT
      </p>
      <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-md border border-[hsl(198_15%_85%)] bg-[hsl(220_12%_92%)]/30">
        <div className={portalStyles.pages}>
          {NOTE_PAGES.map((src) => (
            <Image
              key={src}
              src={src}
              alt=""
              width={999}
              height={1414}
              loading="eager"
              className="block w-full bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudentPortalPreview() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setScale(
        Math.min(rect.width / STUDENT_CANVAS_WIDTH, rect.height / STUDENT_CANVAS_HEIGHT),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      className="marketing-product-ui pointer-events-none relative h-full min-h-[22rem] overflow-hidden rounded-2xl bg-[hsl(220_14%_96%)] ring-1 ring-black/[0.06] select-none"
      aria-hidden
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STUDENT_CANVAS_WIDTH,
          height: STUDENT_CANVAS_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <StudentShell>
          <div className={portalStyles.stage}>
            <div className={portalStyles.subject}>
              <SubjectScene />
            </div>
            <div className={portalStyles.topic}>
              <TopicScene />
            </div>
            <div className={portalStyles.files}>
              <FilesScene />
            </div>
            <div className={portalStyles.notes}>
              <NotesScene />
            </div>
          </div>
        </StudentShell>
      </div>
    </div>
  );
}
