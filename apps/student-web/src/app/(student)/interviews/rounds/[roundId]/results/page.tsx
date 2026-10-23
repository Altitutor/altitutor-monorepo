import { StudentInterviewResults } from "@/features/interviews/components/student-interview-results";

export default function InterviewResultsPage({
  params,
}: {
  params: { roundId: string };
}) {
  return <StudentInterviewResults roundId={params.roundId} />;
}
