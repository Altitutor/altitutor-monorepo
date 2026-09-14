"use client";
import { useState } from "react";
import { Badge, Input, SegmentedControl } from "@altitutor/ui";
import { stages, type Journey } from "../lib/model";
import { actionInsights } from "../lib/insights";
export function ConversionInsights({
  journeys,
  deadlines,
  cadence,
}: {
  journeys: Journey[];
  deadlines: Record<string, number>;
  cadence: number[];
}) {
  const [kind, setKind] = useState<"new" | "returning" | "historical">("new");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const cohort = journeys.filter(
    (j) =>
      (kind === "historical"
        ? j.historical
        : !j.historical &&
          (kind === "returning" ? j.is_returning : !j.is_returning)) &&
      (!from || Boolean(j.enquiry_at && j.enquiry_at.slice(0, 10) >= from)) &&
      (!to || Boolean(j.enquiry_at && j.enquiry_at.slice(0, 10) <= to)),
  );
  const converted = cohort.filter((j) => j.evidence.converted_at);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <SegmentedControl
          value={kind}
          onValueChange={setKind}
          options={[
            { value: "new", label: "New enquiries" },
            { value: "returning", label: "Returning" },
            { value: "historical", label: "Historical" },
          ]}
        />
        <label className="text-sm">
          Enquiry from
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Enquiry through
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Cohorts follow the original enquiry date. Historical records with
        unknown dates are excluded when a date range is selected. Open journeys
        remain unresolved.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Enquiries", cohort.length],
          ["Paid + attended", converted.length],
          [
            "Conversion",
            cohort.length
              ? `${Math.round((converted.length / cohort.length) * 100)}%`
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Milestone</th>
            <th>Reached</th>
            <th>Of enquiries</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage, i) => {
            const count = cohort.filter(
              (j) =>
                [
                  true,
                  Boolean(j.evidence.trial_booked_at),
                  Boolean(j.evidence.trial_attended_at),
                  Boolean(j.evidence.registration_link_at),
                  Boolean(j.evidence.registered_at),
                  j.evidence.classes.length > 0,
                  Boolean(j.evidence.converted_at),
                ][i],
            ).length;
            return (
              <tr className="border-b" key={stage}>
                <td className="p-2">{stage}</td>
                <td>{count}</td>
                <td>
                  {cohort.length
                    ? `${Math.round((count / cohort.length) * 100)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="font-semibold pt-4">Staff response times</h3>
      <p className="text-xs text-muted-foreground">
        Calendar days from the preceding milestone to the recorded action.
        Missing timestamps are excluded.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Action</th>
            <th>Completed</th>
            <th>Median days</th>
            <th>Open</th>
            <th>Overdue</th>
          </tr>
        </thead>
        <tbody>
          {actionInsights(cohort, deadlines, cadence).map((a) => (
            <tr className="border-b" key={a.key}>
              <td className="p-2">{a.label}</td>
              <td>{a.completed}</td>
              <td>{a.medianDays === null ? "—" : a.medianDays.toFixed(1)}</td>
              <td>{a.open}</td>
              <td>
                <Badge variant={a.overdue ? "destructive" : "outline"}>
                  {a.overdue}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="font-semibold pt-4">Closed outcomes</h3>
      <div className="space-y-2">
        {cohort
          .filter((j) => j.closure_reason && j.closure_reason !== "completed")
          .map((j) => (
            <div className="border rounded p-3 text-sm" key={j.id}>
              <strong>{j.label}</strong> ·{" "}
              {j.closure_reason === "unable_to_contact"
                ? "Unable to contact"
                : "Withdrawn"}
              <p className="text-muted-foreground">{j.closure_detail}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
