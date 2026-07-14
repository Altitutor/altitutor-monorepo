export type StudyPlanWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StudyPlanAvailability = {
  weekday: StudyPlanWeekday;
  maxMinutes: number;
};

export type StudyPlanProfileInput = {
  targetScore: number;
  testYear: number;
  testDate: string | null;
  availableDays: StudyPlanAvailability[];
  preferredMockWeekday: StudyPlanWeekday;
};

export type StudyPlanTaskType =
  | "learn"
  | "skill_trainer"
  | "practice"
  | "section_benchmark"
  | "mock"
  | "review";

export type StudyPlanTaskStatus =
  | "planned"
  | "in_progress"
  | "partial"
  | "completed"
  | "skipped";

export type StudyPlanSection = {
  id: string;
  key:
    | "verbal_reasoning"
    | "decision_making"
    | "quantitative_reasoning"
    | "situational_judgement";
  name: string;
  shortName: string;
  sectionNumber: number;
  questionCount: number;
  timePerQuestionSeconds: number;
};

export type StudyPlanSectionSignal = {
  sectionId: string;
  currentEstimate: number | null;
  evidenceCount: number;
  completedFullSets: number;
};

export type StudyPlanLearningModule = {
  id: string;
  title: string;
  sectionId: string | null;
  priority: "essential" | "recommended" | "optional";
  estimatedMinutes: number;
  completionPercent: number;
  relevanceScore: number;
};

export type GeneratedStudyPlanTask = {
  scheduledDate: string;
  sortOrder: number;
  taskType: StudyPlanTaskType;
  title: string;
  description: string;
  rationale: string;
  estimatedMinutes: number;
  targetUnits: number | null;
  sectionId: string | null;
  learningModuleId: string | null;
  launchPath: string;
  launchConfig: Record<string, unknown>;
};

export type StudyPlanCapacityRisk = {
  level: "none" | "warning";
  availableMinutesPerWeek: number;
  recommendedMinutesPerWeek: number;
  message: string | null;
};

export type StudyPlanPhase =
  | "foundation"
  | "development"
  | "performance"
  | "taper";

export type StudyPlanGenerationResult = {
  tasks: GeneratedStudyPlanTask[];
  capacityRisk: StudyPlanCapacityRisk;
  sectionTargets: Record<string, number>;
  endsOn: string;
};

export type StudyPlanTask = GeneratedStudyPlanTask & {
  id: string;
  status: StudyPlanTaskStatus;
  completedUnits: number;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  matchedActivityType: string | null;
  matchedActivityId: string | null;
};

export type StudyPlanResponse = {
  profile: (StudyPlanProfileInput & {
    id: string;
    planningDate: string;
    planningDateIsProvisional: boolean;
    nextWeeklyReplanOn: string | null;
  }) | null;
  generation: {
    id: string;
    generatedAt: string;
    reason: string;
    startsOn: string;
    endsOn: string;
    capacityRisk: StudyPlanCapacityRisk;
    sectionTargets: Record<string, number>;
  } | null;
  tasks: StudyPlanTask[];
  today: string;
  todayTasks: StudyPlanTask[];
  completion: {
    completed: number;
    scheduledThroughToday: number;
    percent: number;
  };
};
