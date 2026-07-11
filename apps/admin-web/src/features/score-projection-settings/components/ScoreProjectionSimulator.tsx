"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import type { ScoreProjectionSettingsWithSection } from "@/features/score-projection-settings/api/score-projection-settings";

const SCORE_MAX = 900;
const HORIZONS = [30, 60, 90, 120] as const;

type Scenario = "pessimistic" | "realistic" | "optimistic";

type ScenarioSettings = {
  baseGain: number;
  roomFraction: number;
  lowScoreBoost: number;
  effortHalfSaturation: number;
};

type SimulatorValues = {
  currentEstimate: number;
  effectiveQuestionsPerWeek: number;
  horizonDays: number;
  stepDays: number;
  effectivePracticeDailyCap: number;
  pessimisticBaseGain: number;
  realisticBaseGain: number;
  optimisticBaseGain: number;
  pessimisticRoomFraction: number;
  realisticRoomFraction: number;
  optimisticRoomFraction: number;
  pessimisticLowScoreBoost: number;
  realisticLowScoreBoost: number;
  optimisticLowScoreBoost: number;
  pessimisticEffortHalfSaturation: number;
  realisticEffortHalfSaturation: number;
  optimisticEffortHalfSaturation: number;
};

type ProjectionPoint = {
  day: number;
  pessimistic: number;
  realistic: number;
  optimistic: number;
};

type NumberField = {
  key: keyof SimulatorValues;
  label: string;
  description: string;
  min: number;
  max?: number;
  step: number;
};

const STUDENT_FIELDS: NumberField[] = [
  {
    key: "currentEstimate",
    label: "Current section score",
    description:
      "Starting score for the simulated section. The projection curves begin from this value.",
    min: 300,
    max: 900,
    step: 1,
  },
  {
    key: "effectiveQuestionsPerWeek",
    label: "Effective questions/week",
    description:
      "Assumed weekly practice pace after source and timing weights. Higher values move the curve further over the same time window, with diminishing returns from the daily cap.",
    min: 0,
    step: 1,
  },
  {
    key: "horizonDays",
    label: "Projection horizon days",
    description:
      "How far into the future the simulator draws the projection curve.",
    min: 1,
    step: 1,
  },
  {
    key: "stepDays",
    label: "Curve step days",
    description:
      "Spacing between generated points on the curve. Smaller values make a smoother chart; larger values make fewer points.",
    min: 1,
    step: 1,
  },
  {
    key: "effectivePracticeDailyCap",
    label: "Effective practice daily cap",
    description:
      "Soft daily cap for practice. It models diminishing returns, so very high daily volume still helps but less efficiently.",
    min: 1,
    step: 1,
  },
];

const SCENARIO_FIELDS: Array<{
  title: string;
  fields: NumberField[];
}> = [
  {
    title: "Base gain",
    fields: [
      {
        key: "pessimisticBaseGain",
        label: "Pessimistic",
        description:
          "Minimum reachable gain for the pessimistic curve before adding upside from remaining room to 900.",
        min: 0,
        step: 1,
      },
      {
        key: "realisticBaseGain",
        label: "Realistic",
        description:
          "Minimum reachable gain for the realistic curve before adding upside from remaining room to 900.",
        min: 0,
        step: 1,
      },
      {
        key: "optimisticBaseGain",
        label: "Optimistic",
        description:
          "Minimum reachable gain for the optimistic curve before adding upside from remaining room to 900.",
        min: 0,
        step: 1,
      },
    ],
  },
  {
    title: "Room fraction",
    fields: [
      {
        key: "pessimisticRoomFraction",
        label: "Pessimistic",
        description:
          "Fraction of the remaining room to 900 that can become reachable on the pessimistic curve.",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "realisticRoomFraction",
        label: "Realistic",
        description:
          "Fraction of the remaining room to 900 that can become reachable on the realistic curve.",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "optimisticRoomFraction",
        label: "Optimistic",
        description:
          "Fraction of the remaining room to 900 that can become reachable on the optimistic curve.",
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    title: "Low-score boost",
    fields: [
      {
        key: "pessimisticLowScoreBoost",
        label: "Pessimistic",
        description:
          "Extra room-based upside for lower starting scores on the pessimistic curve. No effect once the starting score is 700 or higher.",
        min: 0,
        step: 0.01,
      },
      {
        key: "realisticLowScoreBoost",
        label: "Realistic",
        description:
          "Extra room-based upside for lower starting scores on the realistic curve. No effect once the starting score is 700 or higher.",
        min: 0,
        step: 0.01,
      },
      {
        key: "optimisticLowScoreBoost",
        label: "Optimistic",
        description:
          "Extra room-based upside for lower starting scores on the optimistic curve. No effect once the starting score is 700 or higher.",
        min: 0,
        step: 0.01,
      },
    ],
  },
  {
    title: "Effort half-saturation",
    fields: [
      {
        key: "pessimisticEffortHalfSaturation",
        label: "Pessimistic",
        description:
          "Effective practice units needed to realise half of the pessimistic curve's reachable gain. Higher values make improvement slower.",
        min: 1,
        step: 1,
      },
      {
        key: "realisticEffortHalfSaturation",
        label: "Realistic",
        description:
          "Effective practice units needed to realise half of the realistic curve's reachable gain. Higher values make improvement slower.",
        min: 1,
        step: 1,
      },
      {
        key: "optimisticEffortHalfSaturation",
        label: "Optimistic",
        description:
          "Effective practice units needed to realise half of the optimistic curve's reachable gain. Higher values make improvement slower.",
        min: 1,
        step: 1,
      },
    ],
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 300, SCORE_MAX));
}

function valuesFromRow(
  row: ScoreProjectionSettingsWithSection,
): SimulatorValues {
  return {
    currentEstimate: 500,
    effectiveQuestionsPerWeek: row.default_effective_questions_per_week,
    horizonDays: row.trajectory_horizon_days,
    stepDays: row.trajectory_step_days,
    effectivePracticeDailyCap: row.effective_practice_daily_cap,
    pessimisticBaseGain: row.pessimistic_base_gain,
    realisticBaseGain: row.realistic_base_gain,
    optimisticBaseGain: row.optimistic_base_gain,
    pessimisticRoomFraction: row.pessimistic_room_fraction,
    realisticRoomFraction: row.realistic_room_fraction,
    optimisticRoomFraction: row.optimistic_room_fraction,
    pessimisticLowScoreBoost: row.pessimistic_low_score_boost,
    realisticLowScoreBoost: row.realistic_low_score_boost,
    optimisticLowScoreBoost: row.optimistic_low_score_boost,
    pessimisticEffortHalfSaturation: row.pessimistic_effort_half_saturation,
    realisticEffortHalfSaturation: row.realistic_effort_half_saturation,
    optimisticEffortHalfSaturation: row.optimistic_effort_half_saturation,
  };
}

function effectivePracticeOverDays(
  values: SimulatorValues,
  days: number,
): number {
  const daily = Math.max(0, values.effectiveQuestionsPerWeek / 7);
  const cappedDaily =
    values.effectivePracticeDailyCap *
    (1 - Math.exp(-daily / values.effectivePracticeDailyCap));
  return cappedDaily * Math.max(0, days);
}

function scenarioSettings(
  values: SimulatorValues,
  scenario: Scenario,
): ScenarioSettings {
  return {
    baseGain: values[`${scenario}BaseGain`],
    roomFraction: values[`${scenario}RoomFraction`],
    lowScoreBoost: values[`${scenario}LowScoreBoost`],
    effortHalfSaturation: values[`${scenario}EffortHalfSaturation`],
  };
}

function projectScore(
  currentEstimate: number,
  effectivePractice: number,
  settings: ScenarioSettings,
): number {
  const remainingRoom = SCORE_MAX - currentEstimate;
  const lowScoreRoomBoost =
    1 + settings.lowScoreBoost * clamp((700 - currentEstimate) / 400, 0, 1);
  const maxGain = clamp(
    settings.baseGain +
      settings.roomFraction * remainingRoom * lowScoreRoomBoost,
    0,
    remainingRoom,
  );
  const effortFactor =
    1 -
    Math.exp(
      -(Math.log(2) * effectivePractice) / settings.effortHalfSaturation,
    );

  return roundScore(currentEstimate + maxGain * effortFactor);
}

function generateProjection(values: SimulatorValues): ProjectionPoint[] {
  const currentEstimate = clamp(values.currentEstimate, 300, SCORE_MAX);
  const maxDay = Math.max(values.horizonDays, ...HORIZONS);
  const step = Math.max(1, values.stepDays);
  const days = new Set<number>([0, ...HORIZONS]);
  for (let day = step; day <= maxDay; day += step) days.add(day);
  days.add(maxDay);

  return [...days]
    .sort((a, b) => a - b)
    .map((day) => {
      const effectivePractice = effectivePracticeOverDays(values, day);
      return {
        day,
        pessimistic: projectScore(
          currentEstimate,
          effectivePractice,
          scenarioSettings(values, "pessimistic"),
        ),
        realistic: projectScore(
          currentEstimate,
          effectivePractice,
          scenarioSettings(values, "realistic"),
        ),
        optimistic: projectScore(
          currentEstimate,
          effectivePractice,
          scenarioSettings(values, "optimistic"),
        ),
      };
    });
}

function reachableGain(values: SimulatorValues, scenario: Scenario): number {
  const settings = scenarioSettings(values, scenario);
  const currentEstimate = clamp(values.currentEstimate, 300, SCORE_MAX);
  const remainingRoom = SCORE_MAX - currentEstimate;
  const lowScoreRoomBoost =
    1 + settings.lowScoreBoost * clamp((700 - currentEstimate) / 400, 0, 1);
  return Math.round(
    clamp(
      settings.baseGain +
        settings.roomFraction * remainingRoom * lowScoreRoomBoost,
      0,
      remainingRoom,
    ),
  );
}

function NumericInput({
  field,
  values,
  onChange,
}: {
  field: NumberField;
  values: SimulatorValues;
  onChange: (key: keyof SimulatorValues, value: number) => void;
}) {
  const value = values[field.key];
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = clamp(
      parsed,
      field.min,
      field.max ?? Number.POSITIVE_INFINITY,
    );
    setDraft(String(clamped));
    onChange(field.key, clamped);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={`simulator-${String(field.key)}`}>{field.label}</Label>
        <UiTooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${field.label} info`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{field.description}</p>
          </TooltipContent>
        </UiTooltip>
      </div>
      <Input
        id={`simulator-${String(field.key)}`}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next === "" || next === "-" || next === ".") return;
          const parsed = Number(next);
          if (Number.isFinite(parsed)) onChange(field.key, parsed);
        }}
        onBlur={commitDraft}
      />
    </div>
  );
}

function SimulatorTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md dark:bg-brand-dark-bg">
      <p className="font-medium">Day {label}</p>
      {payload.map((item) => (
        <p
          key={item.name}
          className="text-sm tabular-nums"
          style={{ color: item.color }}
        >
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

export function ScoreProjectionSimulator({
  settings,
}: {
  settings: ScoreProjectionSettingsWithSection[];
}) {
  const [sectionId, setSectionId] = useState(settings[0]?.id ?? "");
  const selected = settings.find((row) => row.id === sectionId) ?? settings[0];
  const [values, setValues] = useState<SimulatorValues | null>(() =>
    selected ? valuesFromRow(selected) : null,
  );

  useEffect(() => {
    if (!selected) return;
    setValues(valuesFromRow(selected));
  }, [selected]);

  const projection = useMemo(
    () => (values ? generateProjection(values) : []),
    [values],
  );

  if (!selected || !values) return null;

  const updateValue = (key: keyof SimulatorValues, value: number) => {
    setValues((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: Number.isFinite(value) ? value : 0,
      };
    });
  };

  const pointByDay = new Map(projection.map((point) => [point.day, point]));
  const simulatedEffectivePractice = effectivePracticeOverDays(
    values,
    values.horizonDays,
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Score prediction simulator</CardTitle>
            <CardDescription>
              Adjust student inputs and model constants to inspect how the
              projection curve responds before changing live assumptions.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={selected.id}
              onChange={(event) => setSectionId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {settings.map((row) => (
                <option key={row.id} value={row.id}>
                  Section {row.sectionNumber}: {row.sectionName}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setValues(valuesFromRow(selected))}
            >
              Reset to section
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-4">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={projection}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(day) => `${day}d`}
                  />
                  <YAxis
                    domain={[300, 900]}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<SimulatorTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pessimistic"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 4"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="realistic"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="optimistic"
                    stroke="hsl(142 70% 45%)"
                    strokeDasharray="5 4"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {HORIZONS.map((day) => {
                const point = pointByDay.get(day);
                if (!point) return null;
                return (
                  <div key={day} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      {day} days
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">
                      {point.realistic}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {point.pessimistic} - {point.optimistic}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {STUDENT_FIELDS.map((field) => (
                <NumericInput
                  key={field.key}
                  field={field}
                  values={values}
                  onChange={updateValue}
                />
              ))}
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
              {(["pessimistic", "realistic", "optimistic"] as const).map(
                (scenario) => (
                  <div key={scenario}>
                    <div className="text-xs font-medium capitalize text-muted-foreground">
                      {scenario} reachable gain
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      +{reachableGain(values, scenario)}
                    </div>
                  </div>
                ),
              )}
              <div className="sm:col-span-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Effective practice over horizon
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {Math.round(simulatedEffectivePractice)} units
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {SCENARIO_FIELDS.map((group) => (
                <section key={group.title} className="space-y-2">
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {group.fields.map((field) => (
                      <NumericInput
                        key={field.key}
                        field={field}
                        values={values}
                        onChange={updateValue}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
