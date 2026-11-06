"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, SegmentedControl } from "@altitutor/ui";
import { useOnboardingJourneys } from "../api/queries";
import { enquiryFunnel, funnelStages, type EnquiryCohort } from "../lib/insights";

const colours = ["#7466e9", "#685fe5", "#5072e8", "#337fe4", "#2795d0", "#209eae", "#248e90"];

function FunnelRibbon({ counts }: { counts: number[] }) {
  const total = counts[0];
  const centre = 58;
  const radii = counts.map((count) => 50 * count / total);
  return (
    <svg viewBox="0 0 700 116" className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
      {radii.map((radius, index) => {
        const x = index * 100;
        const left = index === 0 ? radius : (radii[index - 1] + radius) / 2;
        const right = index === radii.length - 1 ? radius : (radius + radii[index + 1]) / 2;
        const path = [
          `M ${x} ${centre - left}`,
          `C ${x + 24} ${centre - left}, ${x + 25} ${centre - radius}, ${x + 50} ${centre - radius}`,
          `S ${x + 76} ${centre - right}, ${x + 100} ${centre - right}`,
          `L ${x + 100} ${centre + right}`,
          `C ${x + 76} ${centre + right}, ${x + 75} ${centre + radius}, ${x + 50} ${centre + radius}`,
          `S ${x + 24} ${centre + left}, ${x} ${centre + left} Z`,
        ].join(" ");
        return <path key={funnelStages[index]} d={path} fill={colours[index]} />;
      })}
    </svg>
  );
}

export function ConversionInsights({ from, to }: { from: string; to: string }) {
  const [cohort, setCohort] = useState<EnquiryCohort>("new");
  const journeys = useOnboardingJourneys();
  const result = enquiryFunnel(journeys.data ?? [], { from, to }, cohort);
  const total = result.counts[0];
  const converted = result.counts[result.counts.length - 1];
  const percentage = (count: number) => total
    ? new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 }).format(count / total)
    : "—";

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle>Customer enquiry funnel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Grouped by original enquiry date. Each milestone shows recorded progress for that cohort.
        </p>
        <SegmentedControl value={cohort} onValueChange={setCohort} options={[
          { value: "new", label: "New enquiries" },
          { value: "returning", label: "Returning" },
          { value: "historical", label: "Historical" },
        ]} />
      </CardHeader>
      <CardContent className="space-y-5">
        {journeys.isError ? <p role="alert" className="text-sm text-destructive">Could not load the enquiry funnel.</p>
          : journeys.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading enquiries…</p>
          : (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">Identified enquiries</dt><dd className="text-xl font-semibold tabular-nums">{total}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">Conversion rate</dt><dd className="text-xl font-semibold tabular-nums">{percentage(converted)}</dd></div>
                {cohort === "new" && <div className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">Unresolved family enquiries</dt><dd className="text-xl font-semibold tabular-nums">{result.unresolvedFamilies}</dd></div>}
                {cohort === "historical" && <div className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">Unknown enquiry date</dt><dd className="text-xl font-semibold tabular-nums">{result.unknownEnquiryDates}</dd></div>}
              </dl>
              {total ? (
                <div className="overflow-x-auto pb-1">
                  <div className="min-w-[700px]">
                    <FunnelRibbon counts={result.counts} />
                    <ol className="grid grid-cols-7 border-t">
                      {funnelStages.map((stage, index) => (
                        <li key={stage} className="space-y-1 px-2 py-3 text-center">
                          <p className="text-sm font-medium">{stage}</p>
                          <p className="text-sm tabular-nums text-muted-foreground">{result.counts[index]} · {percentage(result.counts[index])}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No identified enquiries for this cohort in the selected period.</p>}
            </>
          )}
      </CardContent>
    </Card>
  );
}
