import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  CalculatorMathsItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
  UcatCalculatorMathsCategory,
  UcatSkillTrainerDifficulty,
} from "@altitutor/shared";

type TrainerKey =
  | "quick_syllogism"
  | "mental_maths"
  | "calculator_maths"
  | "numpad_speed";
type ConflictMode = "overwrite" | "make-new";

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

type QuickSyllogismSeedItem = {
  id: string;
  trainerKey: "quick_syllogism";
  trainerId: string;
  content: QuickSyllogismItemContent;
};

type SeedItem =
  | QuickSyllogismSeedItem
  | MentalMathsSeedItem
  | CalculatorMathsSeedItem
  | NumpadSpeedSeedItem;

type RichNode = Record<string, unknown>;

const TRAINER_IDS: Record<TrainerKey, string> = {
  quick_syllogism: "a1000001-0000-4000-8000-000000000003",
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

function argMode(): ConflictMode {
  const value = argString("mode", "overwrite");
  if (value === "overwrite" || value === "make-new") return value;
  throw new Error("--mode must be overwrite or make-new");
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

function stableUuid(trainerKey: TrainerKey, index: number, batch: number): string {
  const prefix: Record<TrainerKey, string> = {
    quick_syllogism: "3",
    mental_maths: "4",
    numpad_speed: "5",
    calculator_maths: "6",
  };
  if (batch > 0xfff) throw new Error("--batch must be <= 4095");
  return `c1000001-0000-4000-8000-${prefix[trainerKey]}${batch.toString(16).padStart(3, "0")}${index.toString(16).padStart(8, "0")}`;
}

function generateMentalMaths(rng: Rng, count: number, batch: number): SeedItem[] {
  return generateUnique(
    batch,
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const content = mentalTemplate(rng, difficulty);
      return {
        id: stableUuid("mental_maths", index + 1, batch),
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
      const a = n === 11 || n === 12 ? rng.int(4, 9) : rng.int(4, 18);
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
      const base = pick(rng, [
        20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
      ]);
      const delta = pick(rng, [9, 11, 19, 21]);
      return { expression: `${base} × ${delta}`, answer: base * delta };
    },
  ];
  const hard = [
    () => {
      const a = pick(rng, [
        12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 30, 32, 35, 40, 45, 50,
      ]);
      const b = pick(rng, [3, 4, 5, 6, 7, 8, 9]);
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

type Term = "A" | "B" | "C" | "D";
type Quantifier =
  | "all"
  | "no"
  | "some"
  | "some_not"
  | "only"
  | "either_or_not_both";
type ConclusionMode = "entailed" | "possible";

type LogicStatement = {
  quantifier: Quantifier;
  left: Term;
  right: Term;
};

type CandidateConclusion = {
  statement: LogicStatement;
  mode: ConclusionMode;
};

type LogicScenario = {
  terms: Record<Term, string>;
  premises: LogicStatement[];
  conclusions: CandidateConclusion[];
  difficulty: UcatSkillTrainerDifficulty;
};

type LogicWorld = Record<Term, number>;

const LOGIC_TERMS: Term[] = ["A", "B", "C", "D"];
const LOGIC_UNIVERSE_SIZE = 4;
const LOGIC_UNIVERSE_MASK = (1 << LOGIC_UNIVERSE_SIZE) - 1;
const VALID_LOGIC_WORLDS = buildLogicWorlds();

const TERM_SETS: Array<Record<Term, string>> = [
  { A: "clinic staff", B: "people with access cards", C: "night-shift workers", D: "trainees" },
  { A: "museum exhibits", B: "valuable objects", C: "items made of gold", D: "loaned pieces" },
  { A: "library members", B: "students", C: "people who borrow journals", D: "visitors" },
  { A: "festival volunteers", B: "people wearing blue badges", C: "first-aid helpers", D: "ticket scanners" },
  { A: "delivery vans", B: "electric vehicles", C: "vehicles allowed downtown", D: "refrigerated vehicles" },
  { A: "research papers", B: "peer-reviewed articles", C: "open-access documents", D: "conference abstracts" },
  { A: "garden plants", B: "flowering plants", C: "plants with thorns", D: "indoor plants" },
  { A: "sports club members wearing red bands", B: "sports club members wearing blue bands", C: "people with lockers", D: "junior athletes" },
  { A: "software accounts", B: "administrator accounts", C: "accounts with audit logs", D: "temporary accounts" },
  { A: "restaurant meals", B: "vegetarian dishes", C: "meals containing nuts", D: "discounted items" },
  { A: "train services with dining cars", B: "express train services", C: "services stopping at Central", D: "weekend services" },
  { A: "workshop tools", B: "electrical tools", C: "items needing inspection", D: "borrowed tools" },
  { A: "hotel guests receiving upgrades", B: "guests booking ten weeks ahead", C: "guests receiving discounts", D: "first-time visitors" },
  { A: "worksite staff carrying hammers", B: "people wearing blue hard hats", C: "people wearing boots", D: "green-hat visitors" },
  { A: "ballet applicants", B: "students who passed the year 4 exam", C: "students from last year's class", D: "students selected this year" },
  { A: "people trained in May", B: "people trained in February", C: "clerks", D: "cleaners" },
  { A: "shop items costing over $50", B: "luxury-brand clothes", C: "items made of leather", D: "shirts" },
  { A: "coins produced from odd digits", B: "silver coins", C: "coins with bird pictures", D: "coins produced from high digits" },
  { A: "restaurants serving chips", B: "restaurants serving wedges", C: "restaurants serving salad", D: "restaurants John visits" },
  { A: "college students taking Maths", B: "students in Anna's tutorial", C: "students taking Spanish", D: "students taking English" },
  { A: "dogs attending day care", B: "energetic dogs", C: "dogs responding to commands", D: "dogs waiting at home" },
  { A: "machines with audit warnings", B: "devices needing inspection", C: "devices cleared for use", D: "devices under warranty" },
  { A: "research applicants with interviews", B: "shortlisted applicants", C: "applicants with references", D: "late applicants" },
  { A: "airport passengers in priority lanes", B: "people with boarding passes", C: "passengers carrying liquids", D: "passengers needing manual checks" },
  { A: "patients booked for scans", B: "patients with referrals", C: "patients needing blood tests", D: "walk-in patients" },
  { A: "delivery orders sent before noon", B: "orders delivered today", C: "orders needing refrigeration", D: "orders sent by courier" },
  { A: "cars entering the low-emission zone", B: "electric cars", C: "cars with city permits", D: "cars towing trailers" },
  { A: "delegates with meal vouchers", B: "registered conference delegates", C: "people with backstage passes", D: "late arrivals" },
  { A: "gym members using the pool", B: "members with towel cards", C: "members attending classes", D: "trial members" },
  { A: "archive files marked confidential", B: "files needing supervisor approval", C: "digitised files", D: "files requested by interns" },
  { A: "students using loan laptops", B: "students signing equipment forms", C: "students in the coding club", D: "students studying remotely" },
  { A: "cakes containing almonds", B: "bakery items with allergen labels", C: "items sold after midday", D: "custom orders" },
];

function generateQuickSyllogisms(
  rng: Rng,
  count: number,
  batch: number,
): SeedItem[] {
  return generateUnique(
    batch,
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const content = quickSyllogismTemplate(rng, difficulty);
      return {
        id: stableUuid("quick_syllogism", index + 1, batch),
        trainerKey: "quick_syllogism",
        trainerId: TRAINER_IDS.quick_syllogism,
        content,
      };
    },
    (item) => item.content.statement,
  );
}

function quickSyllogismTemplate(
  rng: Rng,
  difficulty: UcatSkillTrainerDifficulty,
): QuickSyllogismItemContent {
  const scenario = buildLogicScenario(rng, difficulty);
  const conclusion = pick(rng, scenario.conclusions);
  const answer = solveConclusion(scenario.premises, conclusion);
  const premises = scenario.premises.map((premise) =>
    sentenceForLogicStatement(premise, scenario.terms, rng),
  );
  const conclusionText = sentenceForConclusion(conclusion, scenario.terms, rng);
  return {
    premises,
    conclusion: conclusionText,
    statement: `${premises.join(" ")}\nConclusion: ${conclusionText}`,
    answer,
    difficulty,
  };
}

function buildLogicScenario(
  rng: Rng,
  difficulty: UcatSkillTrainerDifficulty,
): LogicScenario {
  const terms = pick(rng, TERM_SETS);
  const patterns: Array<() => LogicScenario> = [
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "all", left: "A", right: "B" },
        { quantifier: "all", left: "B", right: "C" },
      ],
      conclusions: [
        c("all", "A", "C"),
        c("some", "A", "C"),
        c("all", "C", "A"),
        p("some", "C", "A"),
        c("no", "A", "D"),
      ],
    }),
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "all", left: "A", right: "B" },
        { quantifier: "no", left: "B", right: "C" },
      ],
      conclusions: [
        c("no", "A", "C"),
        c("no", "C", "A"),
        c("some_not", "A", "C"),
        c("all", "A", "C"),
        p("some", "A", "D"),
      ],
    }),
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "some", left: "A", right: "B" },
        { quantifier: "all", left: "B", right: "C" },
      ],
      conclusions: [
        c("some", "A", "C"),
        c("some", "C", "A"),
        c("all", "A", "C"),
        c("all", "B", "A"),
        p("some_not", "A", "C"),
      ],
    }),
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "some_not", left: "A", right: "B" },
        { quantifier: "all", left: "C", right: "B" },
      ],
      conclusions: [
        c("some_not", "A", "C"),
        c("no", "C", "A"),
        c("some", "A", "B"),
        p("some", "A", "C"),
        c("all", "A", "B"),
      ],
    }),
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "only", left: "A", right: "B" },
        { quantifier: "some", left: "C", right: "B" },
      ],
      conclusions: [
        c("some", "C", "A"),
        c("all", "B", "A"),
        c("all", "A", "B"),
        p("some_not", "A", "B"),
        c("no", "C", "A"),
      ],
    }),
    () => ({
      terms,
      difficulty,
      premises: [
        { quantifier: "either_or_not_both", left: "A", right: "B" },
        { quantifier: "all", left: "C", right: "A" },
      ],
      conclusions: [
        c("no", "C", "B"),
        c("some_not", "C", "B"),
        c("all", "C", "B"),
        p("some", "A", "D"),
        c("all", "A", "C"),
      ],
    }),
  ];

  if (difficulty !== "easy") {
    patterns.push(
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "all", left: "A", right: "B" },
          { quantifier: "some", left: "B", right: "C" },
          { quantifier: "no", left: "C", right: "D" },
        ],
        conclusions: [
          c("some", "B", "D"),
          c("no", "A", "D"),
          p("some", "A", "C"),
          c("some_not", "C", "D"),
          c("all", "C", "B"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "some", left: "A", right: "B" },
          { quantifier: "some", left: "A", right: "C" },
          { quantifier: "no", left: "B", right: "C" },
        ],
        conclusions: [
          c("some_not", "A", "B"),
          c("some_not", "A", "C"),
          c("some", "B", "C"),
          p("some", "A", "D"),
          c("all", "A", "B"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "all", left: "A", right: "B" },
          { quantifier: "only", left: "C", right: "B" },
          { quantifier: "some", left: "D", right: "C" },
        ],
        conclusions: [
          c("some", "D", "B"),
          c("all", "B", "C"),
          c("some", "D", "A"),
          p("some", "A", "C"),
          c("no", "D", "A"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "either_or_not_both", left: "A", right: "B" },
          { quantifier: "all", left: "B", right: "C" },
          { quantifier: "no", left: "C", right: "D" },
        ],
        conclusions: [
          c("no", "B", "D"),
          c("some_not", "B", "D"),
          c("all", "D", "A"),
          p("some", "A", "C"),
          c("some", "D", "B"),
        ],
      }),
    );
  }

  if (difficulty === "hard") {
    patterns.push(
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "only", left: "A", right: "B" },
          { quantifier: "either_or_not_both", left: "B", right: "C" },
          { quantifier: "some", left: "D", right: "C" },
        ],
        conclusions: [
          c("no", "A", "C"),
          c("some_not", "D", "B"),
          c("all", "B", "A"),
          p("some", "D", "A"),
          c("some", "D", "B"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "some_not", left: "A", right: "B" },
          { quantifier: "only", left: "C", right: "B" },
          { quantifier: "all", left: "D", right: "A" },
        ],
        conclusions: [
          c("some_not", "A", "C"),
          p("some", "D", "C"),
          c("all", "B", "C"),
          c("some_not", "D", "B"),
          c("some", "A", "D"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "all", left: "A", right: "B" },
          { quantifier: "only", left: "C", right: "D" },
          { quantifier: "no", left: "B", right: "D" },
          { quantifier: "some", left: "C", right: "A" },
        ],
        conclusions: [
          c("some", "A", "D"),
          c("some", "C", "B"),
          c("some_not", "C", "A"),
          p("some", "B", "C"),
          c("no", "A", "D"),
        ],
      }),
      () => ({
        terms,
        difficulty,
        premises: [
          { quantifier: "some", left: "A", right: "B" },
          { quantifier: "all", left: "B", right: "C" },
          { quantifier: "only", left: "D", right: "C" },
          { quantifier: "no", left: "A", right: "D" },
        ],
        conclusions: [
          c("some", "A", "C"),
          c("some_not", "A", "D"),
          c("all", "C", "D"),
          p("some", "B", "D"),
          c("some", "A", "D"),
        ],
      }),
    );
  }

  for (let attempts = 0; attempts < 50; attempts += 1) {
    const scenario = pick(rng, patterns)();
    const validModels = modelsForPremises(scenario.premises);
    if (!validModels.length) continue;
    const labelled = scenario.conclusions.map((candidate) => ({
      candidate,
      answer: solveConclusion(scenario.premises, candidate),
    }));
    if (labelled.some((item) => item.answer) && labelled.some((item) => !item.answer)) {
      return scenario;
    }
  }
  throw new Error("Could not build a valid syllogism scenario");
}

function c(quantifier: Quantifier, left: Term, right: Term): CandidateConclusion {
  return { statement: { quantifier, left, right }, mode: "entailed" };
}

function p(quantifier: Quantifier, left: Term, right: Term): CandidateConclusion {
  return { statement: { quantifier, left, right }, mode: "possible" };
}

function buildLogicWorlds(): LogicWorld[] {
  const worlds: LogicWorld[] = [];
  const max = 1 << (LOGIC_TERMS.length * LOGIC_UNIVERSE_SIZE);
  for (let encoded = 0; encoded < max; encoded += 1) {
    const world = decodeWorld(encoded);
    if (!LOGIC_TERMS.every((term) => world[term] !== 0 && world[term] !== LOGIC_UNIVERSE_MASK)) continue;
    worlds.push(world);
  }
  return worlds;
}

function decodeWorld(encoded: number): LogicWorld {
  return {
    A: encoded & LOGIC_UNIVERSE_MASK,
    B: (encoded >> LOGIC_UNIVERSE_SIZE) & LOGIC_UNIVERSE_MASK,
    C: (encoded >> (LOGIC_UNIVERSE_SIZE * 2)) & LOGIC_UNIVERSE_MASK,
    D: (encoded >> (LOGIC_UNIVERSE_SIZE * 3)) & LOGIC_UNIVERSE_MASK,
  };
}

function modelsForPremises(premises: LogicStatement[]): LogicWorld[] {
  return VALID_LOGIC_WORLDS.filter((world) =>
    premises.every((premise) => evalLogicStatement(world, premise)),
  );
}

function solveConclusion(
  premises: LogicStatement[],
  conclusion: CandidateConclusion,
): boolean {
  const models = modelsForPremises(premises);
  if (!models.length) throw new Error("Syllogism premises are inconsistent");
  if (conclusion.mode === "possible") {
    return models.some((world) => evalLogicStatement(world, conclusion.statement));
  }
  return models.every((world) => evalLogicStatement(world, conclusion.statement));
}

function evalLogicStatement(world: LogicWorld, statement: LogicStatement): boolean {
  const left = world[statement.left];
  const right = world[statement.right];
  switch (statement.quantifier) {
    case "all":
      return (left & ~right) === 0;
    case "no":
      return (left & right) === 0;
    case "some":
      return (left & right) !== 0;
    case "some_not":
      return (left & ~right) !== 0;
    case "only":
      return (right & ~left) === 0;
    case "either_or_not_both":
      return (left | right) === LOGIC_UNIVERSE_MASK && (left & right) === 0;
  }
}

function sentenceForLogicStatement(
  statement: LogicStatement,
  terms: Record<Term, string>,
  rng: Rng,
): string {
  const left = terms[statement.left];
  const right = terms[statement.right];
  switch (statement.quantifier) {
    case "all":
      return pick(rng, [
        `All ${left} are ${right}.`,
        `${capitalize(left)} must be ${right}.`,
      ]);
    case "no":
      return pick(rng, [
        `No ${left} are ${right}.`,
        `${capitalize(left)} are never ${right}.`,
        `There are no ${left} that are also ${right}.`,
      ]);
    case "some":
      return pick(rng, [
        `Some ${left} are ${right}.`,
        `At least some ${left} are ${right}.`,
        `There are ${left} that are also ${right}.`,
      ]);
    case "some_not":
      return pick(rng, [
        `Some ${left} are not ${right}.`,
        `At least some ${left} are outside the group of ${right}.`,
        `Not all ${left} are ${right}.`,
      ]);
    case "only":
      return pick(rng, [
        `Only ${left} are ${right}.`,
        `${capitalize(right)} must be ${left}.`,
        `The only ${right} are ${left}.`,
      ]);
    case "either_or_not_both":
      return pick(rng, [
        `Everything is either ${left} or ${right}, but not both.`,
        `Each case belongs to exactly one of these groups: ${left} or ${right}.`,
        `No case can be both ${left} and ${right}, and every case is one of the two.`,
      ]);
  }
}

function sentenceForConclusion(
  conclusion: CandidateConclusion,
  terms: Record<Term, string>,
  rng: Rng,
): string {
  if (conclusion.mode === "entailed") {
    return sentenceForLogicStatement(conclusion.statement, terms, rng);
  }
  const left = terms[conclusion.statement.left];
  const right = terms[conclusion.statement.right];
  switch (conclusion.statement.quantifier) {
    case "some":
      return pick(rng, [
        `It is possible that some ${left} are ${right}.`,
        `Some ${left} could be ${right}.`,
      ]);
    case "some_not":
      return pick(rng, [
        `It is possible that some ${left} are not ${right}.`,
        `Some ${left} could fall outside the group of ${right}.`,
      ]);
    case "all":
      return `It is possible that all ${left} are ${right}.`;
    case "no":
      return `It is possible that no ${left} are ${right}.`;
    case "only":
      return `It is possible that only ${left} are ${right}.`;
    case "either_or_not_both":
      return `It is possible that everything is either ${left} or ${right}, but not both.`;
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function generateCalculatorMaths(rng: Rng, count: number, batch: number): SeedItem[] {
  return generateUnique(
    batch,
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const category = weightedPick(rng, CALCULATOR_CATEGORY_WEIGHTS);
      const content = calculatorTemplate(rng, category, difficulty);
      return {
        id: stableUuid("calculator_maths", index + 1, batch),
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

function docNode(content: RichNode[]): RichNode {
  return { type: "doc", content };
}

function paragraphNode(text: string): RichNode {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function tableCell(text: string, header = false): RichNode {
  return {
    type: header ? "tableHeader" : "tableCell",
    content: [paragraphNode(text)],
  };
}

function tableNode(columns: string[], rows: string[][]): RichNode {
  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: columns.map((column) => tableCell(column, true)),
      },
      ...rows.map((row) => ({
        type: "tableRow",
        content: columns.map((_, index) => tableCell(row[index] ?? "")),
      })),
    ],
  };
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
    const rows = [
      ["Mon", rng.int(20, 80)],
      ["Tue", rng.int(20, 90)],
      ["Wed", rng.int(20, 100)],
    ] as const;
    const answer = rows.reduce((sum, row) => sum + row[1], 0);
    return {
      question: docNode([
        paragraphNode("The table shows the number of bookings over three days."),
        tableNode(
          ["Day", "Bookings"],
          rows.map(([day, bookings]) => [day, String(bookings)]),
        ),
        paragraphNode("What is the total number of bookings?"),
      ]),
      answer,
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

function generateNumpadSpeed(rng: Rng, count: number, batch: number): SeedItem[] {
  return generateUnique(
    batch,
    count,
    (index) => {
      const difficulty = difficultyForIndex(index);
      const content = numpadTemplate(rng, difficulty);
      return {
        id: stableUuid("numpad_speed", index + 1, batch),
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
  batch: number,
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
      id: stableUuid(item.trainerKey, items.length + 1, batch),
    });
  }

  return items;
}

function validateItems(items: SeedItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}`);
    ids.add(item.id);
    if (item.trainerKey === "quick_syllogism") {
      if (!item.content.statement.trim())
        throw new Error(`Empty syllogism statement for ${item.id}`);
      if (typeof item.content.answer !== "boolean")
        throw new Error(`Invalid syllogism answer for ${item.id}`);
    }
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

function renderSql(
  items: SeedItem[],
  options: { seed: number; batch: number; mode: ConflictMode },
): string {
  const conflictSql =
    options.mode === "overwrite"
      ? `ON CONFLICT (id) DO UPDATE SET
  skill_trainer_id = EXCLUDED.skill_trainer_id,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  approval_status = EXCLUDED.approval_status,
  approved_at = EXCLUDED.approved_at,
  updated_at = NOW()`
      : "ON CONFLICT (id) DO NOTHING";
  const batchLike = `c1000001-0000-4000-8000-_${options.batch.toString(16).padStart(3, "0")}%`;
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
-- UCAT skill trainer generated items
-- =============================================================================
-- Generated by apps/tutor-web/scripts/generate-ucat-skill-trainer-seed.ts
-- Seed: ${options.seed}
-- Batch: ${options.batch}
-- Mode: ${options.mode}
--
-- Batch 0 preserves the original generated UUID range.
-- Use --batch N with N > 0 to generate a non-overlapping UUID range.
-- Mode overwrite updates rows in this batch; mode make-new leaves existing rows untouched.
-- Quick syllogism items are generated with a finite-model logic solver.
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
${conflictSql};

SELECT
  t.key,
  COUNT(i.id) AS generated_approved_active_items
FROM public.ucat_skill_trainers t
LEFT JOIN public.ucat_skill_trainer_items i
  ON i.skill_trainer_id = t.id
  AND i.id::text LIKE '${batchLike}'
  AND i.deleted_at IS NULL
  AND i.is_active = true
  AND i.approval_status = 'approved'
WHERE t.id IN (
  '${TRAINER_IDS.quick_syllogism}',
  '${TRAINER_IDS.mental_maths}',
  '${TRAINER_IDS.numpad_speed}',
  '${TRAINER_IDS.calculator_maths}'
)
GROUP BY t.key, t.sort_order
ORDER BY t.sort_order;
`;
}

async function main(): Promise<void> {
  const syllogismCount = argNumber("syllogism", 300);
  const mentalCount = argNumber("mental", 240);
  const calculatorCount = argNumber("calculator", 360);
  const numpadCount = argNumber("numpad", 240);
  const seed = argNumber("seed", 20260701);
  const batch = argNumber("batch", 0);
  const mode = argMode();
  const out = resolve(process.cwd(), argString("out", DEFAULT_OUT));

  const rng = new Rng(seed);
  const items = [
    ...generateQuickSyllogisms(rng, syllogismCount, batch),
    ...generateMentalMaths(rng, mentalCount, batch),
    ...generateNumpadSpeed(rng, numpadCount, batch),
    ...generateCalculatorMaths(rng, calculatorCount, batch),
  ];
  validateItems(items);

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, renderSql(items, { seed, batch, mode }));
  console.log(`Wrote ${items.length} generated skill trainer items to ${out}`);
  console.log(
    `quick_syllogism=${syllogismCount} mental_maths=${mentalCount} numpad_speed=${numpadCount} calculator_maths=${calculatorCount} batch=${batch} mode=${mode}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
