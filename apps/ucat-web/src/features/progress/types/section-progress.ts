import type { SectionCategoryProgress, SectionProgress } from "@altitutor/shared";

export type SectionProgressResponse = {
  section: SectionProgress;
  categoryProgress: SectionCategoryProgress[];
  totalPublicSets: number;
  totalPublicUntimedSets: number;
  totalPublicTimedSets: number;
  setsCompleted: number;
  untimedSetsCompleted: number;
  timedSetsCompleted: number;
};
