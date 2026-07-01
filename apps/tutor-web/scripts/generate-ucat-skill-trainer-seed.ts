import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  CalculatorMathsItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  UcatCalculatorMathsCategory,
  UcatSkillTrainerDifficulty,
} from "@altitutor/shared";

type TrainerKey = "mental_maths" | "calculator_maths" | "numpad_speed";

type MentalMathsSeedItem = {
  id: string;
  trainerKey: "mental_maths";
  trainerId: string;
  content: MentalMathsItemContent;
};

type CalculatorMathsSeedItem = {
  id: string;
  trainerKey: "calculator_maths";
  trainerId: string;
  content: CalculatorMathsItemContent;
};

type NumpadSpeedSeedItem = {
  id: string;
  trainerKey: "numpad_speed";
  trainerId: string;
  content: NumpadSpeedItemContent;
};

type SeedItem =
  | MentalMathsSeedItem
  | CalculatorMathsSeedItem
  | NumpadSpeedSeedItem;

const TRAINER_IDS: Record<TrainerKey, string> = {
  mental_maths: "a1000001-0000-4000-8000-000000000004",
  numpad_speed: "a1000001-0000-4000-8000-000000000005",
  calculator_maths: "a1000001-0000-4000-8000-000000000006",
};

const DEFAULT_OUT =
  "../../supabase/seed/manual/ucat_skill_trainer_generated_qr_items.sql";

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`--${name} must be a non-negative integer`);
  return value;
}

function argString(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function pick<T>(rng: Rng, values: readonly T[]): T {
  if (values.length === 0) throw new Error("Cannot pick from an empty array");
  return values[rng.int(0, values.length - 1)]!;
}

function weightedPick<T>(
  rng: Rng,
  values: Array<{ value: T; weight: number }>,
): T {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng.next() * total;
  for (const item of values) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return values[values.length - 1]!.value;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentageBase(
  rng: Rng,
  percent: number,
  minMultiplier: number,
  maxMultiplier: number,
): number {
  const denominator =
    percent === 5
      ? 20
      : percent === 10
        ? 10
        : percent === 12.5
          ? 8
          : percent === 15
            ? 20
            : percent === 16
              ? 25
              : percent === 20
                ? 5
                : percent === 25
                  ? 4
                  : percent === 37.5
                    ? 8
                    : 100;
  return denominator * rng.int(minMultiplier, maxMultiplier);
}

function difficultyForIndex(index: number): UcatSkillTrainerDifficulty {
  const mod = index % 10;
  if (mod < 3) return "easy";
  if (mod < 8) return "medium";
  return "hard";
}

function stableUuid(trainerKey: TrainerKey, index: number): string {
  const prefix: Record<TrainerKey, string> = {
    mental_maths: "4",
    numpad_speed: "5",
    calculator_maths: "6",
  };
  return `c1000001-0000-4000-8000-${prefix[trainerKey]}${index.toString(16).padStart(11, "0")}`;
}

function generateMentalMaths(rng: Rng, count: number): SeedItem[] {
  return generateUnique(
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const content = mentalTemplate(rng, difficulty);
      return {
        id: stableUuid("mental_maths", index + 1),
        trainerKey: "mental_maths",
        trainerId: TRAINER_IDS.mental_maths,
        content,
      };
    },
    (item) => item.content.expression,
  );
}

function mentalTemplate(
  rng: Rng,
  difficulty: UcatSkillTrainerDifficulty,
): MentalMathsItemContent {
  const easy = [
    () => {
      const a = rng.int(12, 48);
      const b = rng.int(5, 24);
      const c = rng.int(3, 18);
      return { expression: `${a} + ${b} - ${c}`, answer: a + b - c };
    },
    () => {
      const n = pick(rng, [11, 12, 15, 20, 25]);
      const a = rng.int(4, 18);
      return { expression: `${a} × ${n}`, answer: a * n };
    },
    () => {
      const divisor = pick(rng, [3, 4, 5, 6, 8, 9, 12]);
      const answer = rng.int(6, 24);
      return { expression: `${answer * divisor} ÷ ${divisor}`, answer };
    },
  ];
  const medium = [
    () => {
      const a = rng.int(8, 24);
      const b = rng.int(3, 9);
      const c = rng.int(12, 36);
      return { expression: `${a} × ${b} + ${c}`, answer: a * b + c };
    },
    () => {
      const b = pick(rng, [5, 10, 15, 20, 25]);
      const a = percentageBase(rng, b, 8, 36);
      return { expression: `${b}% of ${a}`, answer: round2((b / 100) * a) };
    },
    () => {
      const c = pick(rng, [2, 3, 4, 5, 6]);
      const answer = rng.int(6, 28);
      const b = rng.int(4, 18);
      const a = answer * c - b;
      return { expression: `(${a} + ${b}) ÷ ${c}`, answer };
    },
    () => {
      const base = rng.int(20, 90);
      const delta = pick(rng, [9, 11, 19, 21]);
      return { expression: `${base} × ${delta}`, answer: base * delta };
    },
  ];
  const hard = [
    () => {
      const a = rng.int(11, 24);
      const b = rng.int(6, 18);
      const c = rng.int(3, 9);
      const quotient = rng.int(2, 9);
      const d = c * quotient;
      return {
        expression: `${a} × ${b} - ${d} ÷ ${c}`,
        answer: a * b - quotient,
      };
    },
    () => {
      const pct = pick(rng, [12.5, 16, 20, 25, 37.5]);
      const a = percentageBase(rng, pct, 10, 36);
      return { expression: `${pct}% of ${a}`, answer: round2((pct / 100) * a) };
    },
    () => {
      const a = rng.int(14, 32);
      const b = rng.int(2, 6);
      const c = rng.int(5, 14);
      return {
        expression: `(${a} + ${c}) × ${b} - ${a}`,
        answer: (a + c) * b - a,
      };
    },
    () => {
      const answer = rng.int(9, 28);
      const divisor = pick(rng, [4, 6, 8, 12]);
      const offset = rng.int(8, 36);
      return {
        expression: `(${answer * divisor + offset} - ${offset}) ÷ ${divisor}`,
        answer,
      };
    },
  ];
  return {
    ...pick(
      rng,
      difficulty === "easy" ? easy : difficulty === "medium" ? medium : hard,
    )(),
    difficulty,
  };
}

const CALCULATOR_CATEGORY_WEIGHTS: Array<{
  value: UcatCalculatorMathsCategory;
  weight: number;
}> = [
  { value: "arithmetic", weight: 12 },
  { value: "percentages", weight: 14 },
  { value: "averages", weight: 10 },
  { value: "decimals", weight: 8 },
  { value: "fractions", weight: 8 },
  { value: "proportion_ratios", weight: 9 },
  { value: "unit_conversions", weight: 8 },
  { value: "speed_distance_time", weight: 7 },
  { value: "financial_maths", weight: 6 },
  { value: "probability", weight: 5 },
  { value: "basic_stats", weight: 5 },
  { value: "algebra", weight: 4 },
  { value: "graphs_tables", weight: 3 },
  { value: "geometry", weight: 2 },
];

function generateCalculatorMaths(rng: Rng, count: number): SeedItem[] {
  return generateUnique(
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const category = weightedPick(rng, CALCULATOR_CATEGORY_WEIGHTS);
      const content = calculatorTemplate(rng, category, difficulty);
      return {
        id: stableUuid("calculator_maths", index + 1),
        trainerKey: "calculator_maths",
        trainerId: TRAINER_IDS.calculator_maths,
        content,
      };
    },
    (item) => item.content.expression ?? JSON.stringify(item.content.question),
  );
}

function calculatorTemplate(
  rng: Rng,
  category: UcatCalculatorMathsCategory,
  difficulty: UcatSkillTrainerDifficulty,
): CalculatorMathsItemContent {
  const make = CALCULATOR_TEMPLATES[category];
  return { ...make(rng, difficulty), category, difficulty };
}

const CALCULATOR_TEMPLATES: Record<
  UcatCalculatorMathsCategory,
  (
    rng: Rng,
    difficulty: UcatSkillTrainerDifficulty,
  ) => Omit<CalculatorMathsItemContent, "category" | "difficulty">
> = {
  arithmetic: (rng) => {
    const a = rng.int(96, 240);
    const b = rng.int(6, 95);
    const c = rng.int(2, 14);
    const expression = rng.bool()
      ? `${a} + ${b} × ${c}`
      : `(${a} - ${b}) × ${c}`;
    const answer = expression.startsWith("(") ? (a - b) * c : a + b * c;
    return { expression, answer };
  },
  percentages: (rng, difficulty) => {
    const base = rng.int(80, difficulty === "hard" ? 1200 : 500);
    const pct = pick(
      rng,
      difficulty === "easy" ? [10, 20, 25, 50] : [12, 15, 18, 22, 35, 37.5],
    );
    const suffix = " Give your answer to 2 d.p. if needed.";
    if (rng.bool(0.45)) {
      return {
        expression: `A value of ${base} increases by ${pct}%. What is the new value?${suffix}`,
        answer: round2(base * (1 + pct / 100)),
      };
    }
    return {
      expression: `What is ${pct}% of ${base}?${suffix}`,
      answer: round2((pct / 100) * base),
    };
  },
  probability: (rng) => {
    const red = rng.int(2, 9);
    const blue = rng.int(2, 9);
    const total = red + blue;
    return {
      expression: `A bag has ${red} red and ${blue} blue counters. What is P(red), as a decimal to 2 d.p.?`,
      answer: round2(red / total),
    };
  },
  averages: (rng, difficulty) => {
    const count = difficulty === "hard" ? 5 : 4;
    const values = Array.from({ length: count }, () => rng.int(12, 88));
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      expression: `Find the mean of ${values.join(", ")}.`,
      answer: round2(total / count),
    };
  },
  algebra: (rng, difficulty) => {
    const x = rng.int(3, difficulty === "hard" ? 18 : 12);
    const a = rng.int(2, 9);
    const b = rng.int(3, 35);
    return {
      expression: `Solve for x: ${a}x + ${b} = ${a * x + b}.`,
      answer: x,
    };
  },
  basic_stats: (rng) => {
    const values = Array.from({ length: 5 }, () => rng.int(10, 80)).sort(
      (a, b) => a - b,
    );
    if (rng.bool()) {
      return {
        expression: `Find the range of ${values.join(", ")}.`,
        answer: values[values.length - 1]! - values[0]!,
      };
    }
    return {
      expression: `Find the median of ${values.join(", ")}.`,
      answer: values[2]!,
    };
  },
  decimals: (rng) => {
    const a = round2(rng.int(12, 95) / 10);
    const b = round2(rng.int(12, 95) / 10);
    const multiplier = pick(rng, [10, 20, 25, 50]);
    return rng.bool()
      ? { expression: `${a} × ${b}`, answer: round2(a * b) }
      : { expression: `${a} × ${multiplier}`, answer: round2(a * multiplier) };
  },
  fractions: (rng) => {
    const denom = pick(rng, [3, 4, 5, 6, 8, 10, 12]);
    const num = rng.int(1, denom - 1);
    const whole = denom * rng.int(8, 60);
    return {
      expression: `What is ${num}/${denom} of ${whole}?`,
      answer: round2((num / denom) * whole),
    };
  },
  unit_conversions: (rng) => {
    const type = pick(rng, ["time", "distance", "volume"] as const);
    if (type === "time") {
      const minutes = rng.int(18, 180);
      return {
        expression: `Convert ${minutes} minutes to hours, to 2 d.p.`,
        answer: round2(minutes / 60),
      };
    }
    if (type === "distance") {
      const metres = rng.int(250, 9500);
      return {
        expression: `Convert ${metres} metres to kilometres, to 2 d.p.`,
        answer: round2(metres / 1000),
      };
    }
    const ml = rng.int(250, 5000);
    return {
      expression: `Convert ${ml} mL to litres, to 2 d.p.`,
      answer: round2(ml / 1000),
    };
  },
  geometry: (rng) => {
    const width = rng.int(4, 24);
    const length = rng.int(6, 36);
    if (rng.bool())
      return {
        expression: `A rectangle is ${length} cm by ${width} cm. Find its area.`,
        answer: length * width,
      };
    return {
      expression: `A rectangle is ${length} cm by ${width} cm. Find its perimeter.`,
      answer: 2 * (length + width),
    };
  },
  graphs_tables: (rng) => {
    const mon = rng.int(20, 80);
    const tue = rng.int(20, 90);
    const wed = rng.int(20, 100);
    return {
      expression: `Table: Mon ${mon}, Tue ${tue}, Wed ${wed}. What is the total for the three days?`,
      answer: mon + tue + wed,
    };
  },
  proportion_ratios: (rng) => {
    const a = rng.int(2, 7);
    const b = rng.int(3, 9);
    const multiplier = rng.int(4, 18);
    return {
      expression: `A:B = ${a}:${b}. If A = ${a * multiplier}, what is B?`,
      answer: b * multiplier,
    };
  },
  speed_distance_time: (rng) => {
    const speed = pick(rng, [30, 40, 50, 60, 80, 90, 100]);
    const hours = pick(rng, [0.5, 0.75, 1.5, 2, 2.5, 3]);
    if (rng.bool())
      return {
        expression: `Travel at ${speed} km/h for ${hours} hours. What distance is covered?`,
        answer: round2(speed * hours),
      };
    const distance = speed * hours;
    return {
      expression: `Travel ${distance} km at ${speed} km/h. How many hours does it take?`,
      answer: round2(hours),
    };
  },
  financial_maths: (rng) => {
    const price = rng.int(20, 400);
    const pct = pick(rng, [5, 10, 12, 15, 20, 25]);
    if (rng.bool())
      return {
        expression: `An item costs $${price} after a ${pct}% discount. How much was discounted, to the nearest cent?`,
        answer: round2(price * (pct / (100 - pct))),
      };
    return {
      expression: `An item costs $${price}. It is discounted by ${pct}%. What is the sale price, to the nearest cent?`,
      answer: round2(price * (1 - pct / 100)),
    };
  },
};

function generateNumpadSpeed(rng: Rng, count: number): SeedItem[] {
  return generateUnique(
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const content = numpadTemplate(rng, difficulty);
      return {
        id: stableUuid("numpad_speed", index + 1),
        trainerKey: "numpad_speed",
        trainerId: TRAINER_IDS.numpad_speed,
        content,
      };
    },
    (item) => item.content.label ?? item.content.button_sequence.join(" "),
  );
}

function numpadTemplate(
  rng: Rng,
  difficulty: UcatSkillTrainerDifficulty,
): NumpadSpeedItemContent {
  if (difficulty !== "easy" && rng.bool(0.14))
    return numpadMemoryTemplate(rng, difficulty);

  const operands =
    difficulty === "easy"
      ? rng.int(2, 3)
      : difficulty === "medium"
        ? rng.int(3, 4)
        : rng.int(4, 5);
  const groups: string[][] = [];
  for (let i = 0; i < operands; i += 1) {
    if (i > 0) {
      const op = pick(rng, ["+", "-", "×", "÷"]);
      groups.push([op]);
    }
    const number = rng.bool(difficulty === "hard" ? 0.35 : 0.18)
      ? `${rng.int(1, 99)}.${rng.int(1, 9)}`
      : String(rng.int(1, difficulty === "easy" ? 99 : 999));
    groups.push(number.split(""));
  }

  const sequence = groups.flat();

  return {
    button_sequence: sequence,
    label: groups.map((group) => group.join("")).join(" "),
    difficulty,
  };
}

function numpadMemoryTemplate(
  rng: Rng,
  difficulty: UcatSkillTrainerDifficulty,
): NumpadSpeedItemContent {
  const groups = [
    numberKeyGroup(rng, difficulty),
    ["M+"],
    numberKeyGroup(rng, difficulty),
    [rng.bool(0.75) ? "M+" : "M-"],
    ["MRC"],
    [pick(rng, ["+", "-", "×", "÷"])],
    numberKeyGroup(rng, difficulty),
  ];

  if (difficulty === "hard" && rng.bool(0.45)) {
    groups.push([pick(rng, ["+", "-", "×", "÷"])], numberKeyGroup(rng, difficulty));
  }

  return {
    button_sequence: groups.flat(),
    label: groups.map((group) => group.join("")).join(" "),
    difficulty,
  };
}

function numberKeyGroup(rng: Rng, difficulty: UcatSkillTrainerDifficulty): string[] {
  const max = difficulty === "easy" ? 99 : 999;
  const value = rng.bool(difficulty === "hard" ? 0.3 : 0.14)
    ? `${rng.int(1, 99)}.${rng.int(1, 9)}`
    : String(rng.int(1, max));
  return value.split("");
}

function generateUnique<T extends SeedItem>(
  count: number,
  make: (index: number) => T,
  keyFor: (item: T) => string | undefined,
): T[] {
  const items: T[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (items.length < count) {
    if (attempts > count * 25)
      throw new Error(`Could not generate ${count} unique items`);
    const item = make(items.length + attempts);
    const key = keyFor(item)?.trim();
    attempts += 1;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      ...item,
      id: stableUuid(item.trainerKey, items.length + 1),
    });
  }

  return items;
}

function validateItems(items: SeedItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}`);
    ids.add(item.id);
    if (
      item.trainerKey === "mental_maths" ||
      item.trainerKey === "calculator_maths"
    ) {
      const answer = item.content.answer;
      if (typeof answer !== "number" || Number.isNaN(answer))
        throw new Error(`Invalid answer for ${item.id}`);
    }
    if (item.trainerKey === "numpad_speed") {
      const sequence = item.content.button_sequence;
      if (!sequence.length)
        throw new Error(`Empty numpad sequence for ${item.id}`);
      if (sequence.includes("="))
        throw new Error(
          `Numpad sequence must not include equals for ${item.id}`,
        );
    }
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderSql(items: SeedItem[], seed: number): string {
  const values = items
    .map((item) => {
      const content = JSON.stringify(item.content);
      return `  (
    '${item.id}',
    '${item.trainerId}',
    ${sqlString(content)}::jsonb,
    true,
    'approved',
    NOW()
  )`;
    })
    .join(",\n");

  return `-- =============================================================================
-- UCAT skill trainer generated QR-speed items
-- =============================================================================
-- Generated by apps/tutor-web/scripts/generate-ucat-skill-trainer-seed.ts
-- Seed: ${seed}
--
-- Safe to re-run: fixed generated UUIDs with ON CONFLICT (id) DO UPDATE.
-- Calculator maths items include content.category and content.difficulty metadata.
-- =============================================================================

INSERT INTO public.ucat_skill_trainer_items (
  id,
  skill_trainer_id,
  content,
  is_active,
  approval_status,
  approved_at
)
VALUES
${values}
ON CONFLICT (id) DO UPDATE SET
  skill_trainer_id = EXCLUDED.skill_trainer_id,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  approval_status = EXCLUDED.approval_status,
  approved_at = EXCLUDED.approved_at,
  updated_at = NOW();

SELECT
  t.key,
  COUNT(i.id) AS generated_approved_active_items
FROM public.ucat_skill_trainers t
LEFT JOIN public.ucat_skill_trainer_items i
  ON i.skill_trainer_id = t.id
  AND i.id::text LIKE 'c1000001-%'
  AND i.deleted_at IS NULL
  AND i.is_active = true
  AND i.approval_status = 'approved'
WHERE t.id IN (
  '${TRAINER_IDS.mental_maths}',
  '${TRAINER_IDS.numpad_speed}',
  '${TRAINER_IDS.calculator_maths}'
)
GROUP BY t.key, t.sort_order
ORDER BY t.sort_order;
`;
}

async function main(): Promise<void> {
  const mentalCount = argNumber("mental", 240);
  const calculatorCount = argNumber("calculator", 360);
  const numpadCount = argNumber("numpad", 240);
  const seed = argNumber("seed", 20260701);
  const out = resolve(process.cwd(), argString("out", DEFAULT_OUT));

  const rng = new Rng(seed);
  const items = [
    ...generateMentalMaths(rng, mentalCount),
    ...generateNumpadSpeed(rng, numpadCount),
    ...generateCalculatorMaths(rng, calculatorCount),
  ];
  validateItems(items);

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, renderSql(items, seed));
  console.log(`Wrote ${items.length} generated skill trainer items to ${out}`);
  console.log(
    `mental_maths=${mentalCount} numpad_speed=${numpadCount} calculator_maths=${calculatorCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
