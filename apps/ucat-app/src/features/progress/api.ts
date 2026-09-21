import { api } from "@/lib/api";
import type { ScoreProjectionResponse } from "./projection-types";
import type { SectionProgressResponse } from "./section-types";
export type Activity = {
  timezone: string;
  startedAt: string | null;
  days: { dateKey: string; questionAttempts: number; setAttempts: number }[];
};
export const progressApi = {
  timing: (number: string) =>
    api<{ points: { examSpeedPercentSum: number; examSpeedCount: number }[] }>(
      `/progress/series?source=set&sectionNumber=${encodeURIComponent(number)}`,
    ),
  projection: () => api<ScoreProjectionResponse>("/score-projection"),
  activity: () => api<Activity>("/activity"),
  section: (number: string) =>
    api<SectionProgressResponse>(`/progress/sections/${number}/summary`),
};
