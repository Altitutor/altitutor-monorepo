import type { Json } from "../supabase/generated";

export const performanceReviewPath = "/interviews/performance-reviews";

export interface InterviewReviewMock {
  id: string;
  title: string;
  date: string;
  released: boolean;
  score: number | null;
  maximumPoints: number | null;
  stations: {
    id: string;
    name: string;
    score: number | null;
    maximumPoints: number;
    notAssessedReason: string | null;
    feedback: Json;
    questions: { id: string; title: Json; feedback: Json }[];
  }[];
}

export interface InterviewReviewFields {
  studentId: string | null;
  date: string;
  template: string;
  body: Json;
}

export interface InterviewReviewRelease extends InterviewReviewFields {
  mocks: InterviewReviewMock[];
}

export interface InterviewReviewSummary {
  id: string;
  date: string;
  author: string;
}

export type StudentInterviewReview = InterviewReviewRelease & InterviewReviewSummary;

export interface TutorInterviewReview extends InterviewReviewFields {
  id: string;
  authorId: string;
  author: string;
  student: string | null;
  version: number | null;
  published: Omit<InterviewReviewRelease, "mocks"> | null;
  editing: boolean;
}

export type TutorInterviewReviewSummary = Omit<TutorInterviewReview, "body" | "published"> & {
  published: Omit<InterviewReviewRelease, "body" | "mocks"> | null;
};

export interface InterviewReviewTemplate {
  id: string;
  name: string;
  body: Json;
  version: number;
}

export type InterviewReviewCommand =
  | { type: "createReview"; id: string; date: string }
  | { type: "saveReview" | "publishReview"; id: string; expectedVersion: number; fields: InterviewReviewFields }
  | { type: "saveTemplate"; id: string; expectedVersion: number; name: string; body: Json };

export function formatInterviewReviewDate(value: string) {
  return value ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "—";
}
