import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  HelpCircle,
  ClipboardCheck,
  FileStack,
  Gauge,
  Home,
  Menu,
  Sparkles,
  Target,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: Home },
  { label: "Study plan", icon: CalendarDays },
  { label: "Practice", icon: ClipboardCheck },
  { label: "Sets & mocks", icon: FileStack },
  { label: "Progress", icon: BarChart3 },
] as const;

const sectionScores = [
  { label: "Verbal Reasoning", score: 710, target: 760, width: "74%" },
  { label: "Decision Making", score: 730, target: 760, width: "81%" },
  { label: "Quantitative Reasoning", score: 665, target: 780, width: "58%" },
] as const;

export function UcatAppOverviewPreview() {
  return (
    <div className="ucat-product-ui overflow-hidden rounded-[1.35rem] bg-[#e8eaed] text-[#1a1a1a] shadow-[0_30px_90px_rgba(3,18,29,0.32)] ring-1 ring-white/20">
      <div className="flex h-10 items-center justify-between border-b border-black/[0.06] bg-white px-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[#ff6b5e]" />
          <span className="size-2 rounded-full bg-[#f2c14e]" />
          <span className="size-2 rounded-full bg-[#65bd7d]" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
          Product preview · sample student data
        </span>
      </div>

      <div className="grid h-[34rem] grid-cols-[3.75rem_minmax(0,1fr)] bg-[#e8eaed] sm:grid-cols-[12rem_minmax(0,1fr)] lg:h-[40rem]">
        <aside className="border-r border-black/[0.055] bg-white p-2 sm:p-3">
          <div className="mb-5 flex h-11 items-center gap-2 px-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#0a2941] text-xs font-bold text-white">
              A
            </span>
            <span className="hidden text-sm font-bold sm:block">Altitutor UCAT</span>
          </div>
          <nav aria-label="Product preview navigation" className="space-y-1">
            {navigation.map(({ label, icon: Icon }) => {
              const active = label === "Dashboard";
              return (
                <div
                  key={label}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[#e8eaed] font-semibold text-[#0a2941]"
                      : "text-black/55"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:block">{label}</span>
                </div>
              );
            })}
          </nav>
          <div className="mt-5 hidden rounded-xl bg-[#f4f5f6] p-3 sm:block">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <HelpCircle className="size-3.5" aria-hidden /> Need a hand?
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-black/48">
              Ask the team about your preparation.
            </p>
          </div>
        </aside>

        <div className="min-w-0 overflow-hidden">
          <header className="flex h-[4.4rem] items-center justify-between border-b border-black/[0.045] bg-white px-4 sm:px-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-black/40">
                Dashboard
              </p>
              <p className="mt-0.5 text-base font-semibold sm:text-lg">Good afternoon, Alex</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[#e8eaed] px-3 py-1.5 text-[11px] font-semibold text-[#0a2941] sm:block">
                Free · 9 questions left
              </span>
              <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
                <Menu className="size-4" aria-hidden />
              </span>
            </div>
          </header>

          <div className="h-[calc(100%-4.4rem)] overflow-hidden p-3 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)]">
              <section className="rounded-[1.15rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-black/42">
                      Predicted score trajectory
                    </p>
                    <h3 className="mt-1 text-lg font-semibold sm:text-xl">Your target is within reach</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#0a2941] sm:text-2xl">2,105</p>
                    <p className="text-[9px] uppercase tracking-wider text-black/38">Current estimate</p>
                  </div>
                </div>

                <div className="relative mt-5 h-36 overflow-hidden rounded-xl bg-[#f5f6f7] sm:h-44">
                  <div className="absolute inset-x-4 top-[23%] border-t border-dashed border-[#0a2941]/25" />
                  <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-black/10" />
                  <div className="absolute inset-x-4 top-[77%] border-t border-dashed border-black/10" />
                  <div className="absolute left-[8%] top-[67%] h-1 w-[30%] origin-left -rotate-[10deg] rounded-full bg-[#92b9c6]" />
                  <div className="absolute left-[36%] top-[56%] h-1 w-[31%] origin-left -rotate-[17deg] rounded-full bg-[#92b9c6]" />
                  <div className="absolute left-[65%] top-[38%] h-1 w-[29%] origin-left -rotate-[14deg] rounded-full bg-[#92b9c6]" />
                  {[
                    { left: "8%", top: "65%", label: "Now" },
                    { left: "37%", top: "54%", label: "Aug" },
                    { left: "66%", top: "36%", label: "Nov" },
                    { left: "93%", top: "22%", label: "Test" },
                  ].map((point) => (
                    <div key={point.label} className="absolute -translate-x-1/2" style={{ left: point.left, top: point.top }}>
                      <span className="block size-3 rounded-full border-[3px] border-white bg-[#0a2941] shadow-[0_0_0_2px_rgba(10,41,65,0.16)]" />
                      <span className="mt-2 block -translate-x-1/3 text-[9px] font-medium text-black/42">{point.label}</span>
                    </div>
                  ))}
                  <span className="absolute right-4 top-[13%] rounded-full bg-[#0a2941] px-2 py-1 text-[9px] font-semibold text-white">
                    Target 2,350
                  </span>
                </div>
              </section>

              <section className="flex min-h-[15rem] flex-col rounded-[1.15rem] bg-[#0a2941] p-4 text-white shadow-sm ring-1 ring-black/[0.055] sm:p-5">
                <div className="flex items-center justify-between gap-3 text-[#b8d2da]">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em]">
                    <Target className="size-4" aria-hidden /> Today&apos;s next step
                  </span>
                  <span className="text-[10px]">25 min</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">Strengthen Quantitative Reasoning</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/62">
                  Complete a focused timed block, then review each miss.
                </p>
                <p className="mt-4 text-[11px] leading-relaxed text-white/45">
                  Chosen because QR is furthest from your section target.
                </p>
                <span className="mt-auto flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-sm font-semibold text-[#0a2941]">
                  Start today&apos;s task <ChevronRight className="size-4" aria-hidden />
                </span>
              </section>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {sectionScores.map((section) => (
                <section key={section.label} className="rounded-[1.1rem] bg-white p-3.5 shadow-sm ring-1 ring-black/[0.055] sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-black/52">{section.label}</span>
                    <Gauge className="size-3.5 text-[#0a2941]" aria-hidden />
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <strong className="text-xl">{section.score}</strong>
                    <span className="text-[9px] text-black/38">Target {section.target}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
                    <div className="h-full rounded-full bg-[#92b9c6]" style={{ width: section.width }} />
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-3 hidden grid-cols-3 gap-3 lg:grid">
              {[{ icon: BookOpen, label: "Learning modules", value: "Continue VR foundations" }, { icon: Sparkles, label: "Skill trainers", value: "Syllogism speed" }, { icon: ClipboardCheck, label: "Recent review", value: "3 patterns identified" }].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-[1.1rem] bg-white p-3.5 text-left shadow-sm ring-1 ring-black/[0.055]">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#e8eaed] text-[#0a2941]"><Icon className="size-4" aria-hidden /></span>
                  <span className="min-w-0"><span className="block text-[9px] uppercase tracking-wider text-black/38">{label}</span><span className="mt-0.5 block truncate text-xs font-semibold">{value}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
