export type MockProgressResponse = {
  averageScaledScore: number | null;
  attemptCount: number;
  unreviewedAttemptCount: number;
  totalPublicMocks: number;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    sectionNumber: number;
    averageScaledScore: number | null;
  }>;
};
