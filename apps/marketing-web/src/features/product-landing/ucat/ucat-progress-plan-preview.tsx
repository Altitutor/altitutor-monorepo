import { CalendarCheck, ChevronRight, Sparkles, Target } from "lucide-react";

const tasks = [
  ["Syllogism speed warm-up", "6 min", "Trainer"],
  ["Reading Comprehension · 0.75×", "22 min", "Practice"],
  ["Review today’s attempt", "7 min", "Review"],
] as const;

export function UcatProgressPlanPreview() {
  return (
    <div className="ucat-product-ui min-h-[30rem] rounded-[1.25rem] bg-[#e8eaed] p-3 text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.14)] ring-1 ring-black/[0.08] sm:p-5">
      <section className="relative overflow-hidden rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold">Score progress</p><p className="mt-1 text-[10px] text-black/44">Current estimate 2,105 · Target 2,350</p></div>
          <span className="rounded-full bg-[#e8eaed] px-2.5 py-1 text-[10px] font-semibold text-[#0a2941]">Estimate forming</span>
        </div>
        <div className="relative mt-4 h-44 overflow-hidden rounded-xl bg-[#f5f6f7]">
          {[24, 50, 76].map((top) => <span key={top} className="absolute inset-x-4 border-t border-dashed border-black/10" style={{ top: `${top}%` }} />)}
          <span className="absolute inset-x-4 top-[20%] border-t border-dashed border-[#0a2941]/28" />
          <span className="absolute right-4 top-[10%] rounded-full bg-[#0a2941] px-2 py-1 text-[9px] font-semibold text-white">Target 2,350</span>
          <svg viewBox="0 0 600 180" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-label="Historical score and projected trajectory">
            <path d="M28 142 C92 139 132 125 184 126 S270 98 322 101" fill="none" stroke="#0a2941" strokeWidth="4" strokeLinecap="round" />
            <path d="M322 101 C390 91 452 67 572 45" fill="none" stroke="#92b9c6" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 7" />
            <path d="M322 80 C410 65 487 40 572 23 L572 72 C482 82 402 110 322 119 Z" fill="#92b9c6" opacity="0.19" />
          </svg>
          <span className="absolute bottom-3 left-4 text-[9px] text-black/38">Historical estimates</span>
          <span className="absolute bottom-3 right-4 text-[9px] text-black/38">Projected to test day</span>
        </div>
      </section>

      <section className="mt-3 rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><CalendarCheck className="size-4 text-[#0a2941]" aria-hidden /><span className="text-xs font-semibold">Next tasks · today</span></div>
          <span className="flex items-center gap-1 rounded-full bg-[#e8eaed] px-2.5 py-1 text-[9px] font-semibold"><Target className="size-3" aria-hidden /> 35 min</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {tasks.map(([title, time, type], index) => (
            <button key={title} type="button" className={`rounded-xl border p-3 text-left ${index === 1 ? "border-[#0a2941] bg-[#e8eaed]" : "border-black/[0.07]"}`}>
              <span className="flex items-center justify-between gap-2"><span className="text-[9px] uppercase tracking-wider text-black/38">{type}</span><ChevronRight className="size-3 text-black/30" aria-hidden /></span>
              <span className="mt-2 block text-[11px] font-semibold leading-snug">{title}</span>
              <span className="mt-2 block text-[9px] text-black/42">About {time}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#0a2941] p-3 text-[10px] leading-relaxed text-white/65"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#92b9c6]" aria-hidden /><span><strong className="text-white">Why this focus:</strong> Reading Comprehension is currently furthest from your Verbal Reasoning target.</span></p>
      </section>
    </div>
  );
}
