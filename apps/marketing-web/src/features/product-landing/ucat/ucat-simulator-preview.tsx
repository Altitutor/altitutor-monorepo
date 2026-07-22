"use client";

import { useState } from "react";
import { UcatExamActionButton, UcatExamShell } from "@altitutor/ui";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  Navigation,
} from "lucide-react";
import { UcatCalculatorPreview } from "./ucat-calculator-preview";

const options = [
  "The cost of labour or parts exceeded the cost of a comparable new item",
  "No suitable replacement part could be obtained",
  "Technicians considered the items unsafe to repair",
  "The council would not pay for the initial assessment",
] as const;

export function UcatSimulatorPreview() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(12);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const moveQuestion = (direction: -1 | 1) => {
    setQuestionNumber((current) =>
      Math.min(29, Math.max(1, current + direction)),
    );
    setSelectedOption(null);
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[1.25rem] bg-white shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08]">
      <UcatExamShell
        sectionTitle="Verbal Reasoning"
        sectionTitleRight={
          <span className="block text-right font-[Tahoma] leading-tight">
            <span className="block">Time Remaining 18:42</span>
            <span className="block">Question {questionNumber} of 29</span>
          </span>
        }
        toolLeft={
          <button
            type="button"
            onClick={() => setCalculatorOpen((open) => !open)}
            aria-pressed={calculatorOpen}
            className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
          >
            <Calculator className="size-4" aria-hidden />
            <span className="text-[13pt]">
              <span className="underline">C</span>alculator
            </span>
          </button>
        }
        toolRight={
          <button
            type="button"
            onClick={() => setFlagged((current) => !current)}
            aria-pressed={flagged}
            className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
          >
            <span
              className={
                flagged
                  ? "inline-flex rounded-sm bg-[#fffd6f] p-0.5 text-[#1b4c7d]"
                  : "inline-flex"
              }
            >
              <Flag className="size-4" aria-hidden />
            </span>
            <span className="text-[13pt]">
              <span className="underline">F</span>lag for Review
            </span>
          </button>
        }
        footerRight={
          <>
            {questionNumber > 1 ? (
              <UcatExamActionButton
                onClick={() => moveQuestion(-1)}
                icon={<ArrowLeft className="size-4" />}
              >
                <span className="text-[14pt]">
                  <span className="underline">P</span>revious
                </span>
              </UcatExamActionButton>
            ) : null}
            <UcatExamActionButton icon={<Navigation className="size-4" />}>
              <span className="text-[14pt]">
                Na<span className="underline">v</span>igator
              </span>
            </UcatExamActionButton>
            <UcatExamActionButton
              onClick={() => moveQuestion(1)}
              variant="highlight"
              icon={<ArrowRight className="size-4" />}
              iconRight
            >
              <span className="text-[14pt]">
                <span className="underline">N</span>ext
              </span>
            </UcatExamActionButton>
          </>
        }
      >
        <div className="flex h-full min-h-0 gap-4 font-[Arial] text-[11pt] leading-relaxed">
          <article className="h-full min-w-0 flex-[3] overflow-y-auto border-r-[6px] border-[#2f608e] py-4 pr-4 sm:py-5">
            <p>
              In 2021, the coastal city of Bellhaven began a three-year trial
              called Fix First. Residents could take small household appliances
              to one of six repair hubs, where technicians assessed whether an
              item could be repaired, recycled or returned to its owner
              unchanged. The council funded the assessment, but owners paid for
              replacement parts. The scheme was intended to reduce waste,
              although its organisers also wanted to collect evidence about why
              products were discarded.
            </p>
            <p className="mt-3">
              The hubs recorded 18,400 visits in their first 18 months. Of the
              items assessed, 46% were repaired during the first appointment and
              a further 19% were repaired after a part was ordered. In 21% of
              cases, repair was considered possible but uneconomic because the
              required labour or part cost more than a comparable new item. The
              remaining items included products for which no suitable part was
              available, as well as appliances judged unsafe to repair.
            </p>
            <p className="mt-3">
              Fix First found that availability of parts varied sharply between
              product types. Bellhaven later introduced a voluntary “repairable
              by design” label for manufacturers that agreed to supply selected
              spare parts for seven years and publish repair information.
            </p>
            <p className="mt-3">
              A university team cautioned against treating repair rates as a
              direct measure of environmental benefit because the study did not
              track how long repaired items remained in use.
            </p>
          </article>

          <section className="h-full min-w-0 flex-[2] overflow-y-auto py-4 pl-2 pr-1 sm:py-5">
            <p className="font-medium text-[12pt]">
              According to the passage, why were some items classed as possible
              to repair but not repaired?
            </p>
            <div className="mt-3 space-y-2 pl-0 sm:pl-6">
              {options.map((option, index) => {
                const selected = selectedOption === index;
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-start gap-2"
                  >
                    <input
                      type="radio"
                      name="marketing-ucat-question"
                      checked={selected}
                      onChange={() => setSelectedOption(index)}
                      className="mt-1 size-4"
                    />
                    <span className="flex min-w-0">
                      <span className="inline-block w-6 shrink-0 sm:w-8">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="ml-0 min-w-0 sm:ml-4">{option}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      </UcatExamShell>
      {calculatorOpen ? (
        <UcatCalculatorPreview onClose={() => setCalculatorOpen(false)} />
      ) : null}
    </div>
  );
}
