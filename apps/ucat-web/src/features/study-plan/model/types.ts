export type StudyPlanWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StudyPlanSjtPreference = "normally" | "a_little" | "not_at_all";

export type StudyPlanAvailability = {
  weekday: StudyPlanWeekday;
  maxMinutes: number;
};

export type StudyPlanProfileInput = {
  studyPlanEnabled: boolean;
  targetScore: number;
  testYear: number;
  testDate: string | null;
  availableDays: StudyPlanAvailability[];
  preferredMockWeekday: StudyPlanWeekday;
  sjtPreference?: StudyPlanSjtPreference;
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

export type StudyPlanExtraStudyMinutes = 10 | 20 | 30 | 45;

export type StudyPlanExtraStudyInput = {
  minutes: StudyPlanExtraStudyMinutes;
  sectionKey: StudyPlanSection["key"] | null;
};

export type StudyPlanSectionSignal = {
  sectionId: string;
  currentEstimate: number | null;
  evidenceCount: number;
  scoreConfidence?: "low" | "medium" | "high" | null;
  completedFullSets: number;
  attemptedQuestionCount?: number;
  completedPracticeSessions?: number;
  qualifyingPracticeSessions?: number;
  largestPracticeSessionQuestionCount?: number;
  recentAccuracy?: number | null;
  observedPace?: number | null;
  representativeSessionCount?: number;
  representativeSectionEquivalents?: number;
  representativeAccuracy?: number | null;
  targetedPracticeSessionCount?: number;
  targetedSectionEquivalents?: number;
  benchmarkCompleted?: boolean;
  benchmarkAccuracy?: number | null;
  benchmarkPace?: number | null;
  learningGraduatedAt?: string | null;
  learningGraduationRoute?: "accuracy" | "experience" | null;
  learningGraduationPolicyVersion?: string | null;
  prescribedPace?: number | null;
  prescribedPaceSetAt?: string | null;
  pacePolicyVersion?: string | null;
  timingDecisionCode?: StudyPlanTimingDecisionCode;
  timingAdvanceFrom?: number | null;
  timingAdvanceTo?: number | null;
  timingCapacityConstrained?: boolean;
  calibrationDue?: boolean;
  overspeedEligible?: boolean;
  overspeedPace?: number | null;
};

export type StudyPlanTimingBreadth = "broad" | "mixed" | "narrow";

export type StudyPlanTimingEvidenceSession = {
  id: string;
  sectionId: string;
  source: "practice" | "set" | "mock";
  completedAt: string;
  prescribedPace: number | null;
  observedPace: number | null;
  accuracy: number | null;
  sectionEquivalents: number;
  breadth: StudyPlanTimingBreadth;
  categoryIds: string[];
};

export type StudyPlanTimingDecisionCode =
  | "timing.initial_placement"
  | "timing.hold_insufficient_evidence"
  | "timing.hold_accuracy"
  | "timing.advance_normal"
  | "timing.advance_accelerated_1x"
  | "timing.advance_deadline"
  | "timing.at_exam_pace";

export type StudyPlanCategorySignal = {
  id: string;
  sectionId: string;
  name: string;
  availableQuestionCount: number;
  correctScore: number;
  maxScore: number;
  weaknessScore: number;
  attemptedQuestionCount?: number;
  completedPracticeSessions?: number;
  qualifyingPracticeSessions?: number;
  largestPracticeSessionQuestionCount?: number;
  recentAccuracy?: number | null;
  observedPace?: number | null;
};

export type StudyPlanSkillTrainer = {
  id: string;
  key: string;
  name: string;
  sectionId: string;
  categoryIds: string[];
  estimatedMinutes: number;
};

export type StudyPlanLearningModule = {
  id: string;
  title: string;
  sectionId: string | null;
  sectionNumber: number | null;
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
  questionStemCategoryId: string | null;
  questionTagId: string | null;
  learningModuleId: string | null;
  questionSetId: string | null;
  mockId: string | null;
  skillTrainerId: string | null;
  launchPath: string;
  launchConfig: Record<string, unknown>;
  /** Ephemeral generator-only link resolved to sourceTaskId before persistence. */
  sourceTaskRef?: {
    scheduledDate: string;
    sortOrder: number;
  };
};

export type StudyPlanCapacityRisk = {
  level: "none" | "warning";
  availableMinutesPerWeek: number;
  recommendedMinutesPerWeek: number;
  outstandingSectionEquivalents: number;
  schedulableSectionEquivalents: number;
  message: string | null;
};

export type StudyPlanTrainingMode = "learning" | "timing" | "exam";

export type StudyPlanReadinessRoute =
  | "accuracy"
  | "experience"
  | "exam_override"
  | null;

export type StudyPlanReadinessUnit = {
  id: string;
  name: string;
  scope: "section" | "category";
  attemptedQuestionCount: number;
  completedPracticeSessions: number;
  qualifyingPracticeSessions: number;
  largestPracticeSessionQuestionCount: number;
  accuracy: number | null;
  coverageComplete: boolean;
  learningComplete: boolean;
  readinessRoute: StudyPlanReadinessRoute;
};

export type StudyPlanSectionReadiness = {
  sectionId: string;
  sectionKey: StudyPlanSection["key"];
  mode: StudyPlanTrainingMode;
  paceMultiplier: number;
  observedPace: number | null;
  learningGraduatedAt: string | null;
  learningRoute: Exclude<
    StudyPlanReadinessRoute,
    "exam_override" | null
  > | null;
  nextMilestone: string;
  timingDecisionCode: StudyPlanTimingDecisionCode;
  calibrationDue: boolean;
  overspeedEligible: boolean;
  overspeedPace: number | null;
  units: StudyPlanReadinessUnit[];
};

export type StudyPlanReadinessSnapshot = {
  mode: StudyPlanTrainingMode;
  examDateOverride: boolean;
  daysUntilExam: number;
  sections: StudyPlanSectionReadiness[];
};

export type StudyPlanGenerationResult = {
  tasks: GeneratedStudyPlanTask[];
  capacityRisk: StudyPlanCapacityRisk;
  sectionTargets: Record<string, number>;
  readiness: StudyPlanReadinessSnapshot;
  endsOn: string;
};

export type StudyPlanTask = GeneratedStudyPlanTask & {
  id: string;
  sourceTaskId: string | null;
  status: StudyPlanTaskStatus;
  completedUnits: number;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  matchedActivityType: string | null;
  matchedActivityId: string | null;
};

export type StudyGuidanceItem = {
  id: string;
  position: 1 | 2;
  triggerKey: string;
  generatedOn: string;
  taskType: StudyPlanTaskType;
  title: string;
  description: string;
  rationale: string;
  estimatedMinutes: number;
  sectionId: string | null;
  questionStemCategoryId: string | null;
  learningModuleId: string | null;
  questionSetId: string | null;
  mockId: string | null;
  skillTrainerId: string | null;
  sourceAttemptType: "practice_session" | "set_attempt" | "mock_attempt" | null;
  sourceAttemptId: string | null;
  launchPath: string;
  launchConfig: Record<string, unknown>;
};

export type StudyGuidanceAlternativeInput = {
  excludedKeys: string[];
  currentTaskTypes: StudyPlanTaskType[];
};

export type StudyPlanResponse = {
  profile:
    | (StudyPlanProfileInput & {
        id: string;
        planningDate: string;
        planningDateIsProvisional: boolean;
        nextWeeklyReplanOn: string | null;
      })
    | null;
  generation: {
    id: string;
    generatedAt: string;
    reason: string;
    startsOn: string;
    endsOn: string;
    capacityRisk: StudyPlanCapacityRisk;
    sectionTargets: Record<string, number>;
    readiness?: StudyPlanReadinessSnapshot | null;
  } | null;
  tasks: StudyPlanTask[];
  nextSteps: StudyGuidanceItem[];
  today: string;
  todayTasks: StudyPlanTask[];
  completion: {
    completed: number;
    scheduledThroughToday: number;
    percent: number;
  };
};
