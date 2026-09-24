export type InsightFeedbackComment = {
  text: string;
  reasonCode: string | null;
  createdAt: string;
};

export type InsightFeedbackRow = {
  id: string;
  targetType: string;
  targetKey: string;
  targetVersion: string;
  displayedContent: Record<string, string>;
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  downvoteRate: number;
  reasonCounts: Record<string, number>;
  surfaceCounts: Record<string, number>;
  comments: InsightFeedbackComment[];
  firstAt: string;
  latestAt: string;
};
