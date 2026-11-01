import { StudentInterviewResults } from "@/features/interviews/components/student-interview-results";

export default async function InterviewResultsPage(
  props: {
    params: Promise<{ roundId: string }>;
  }
) {
  const params = await props.params;
  return <StudentInterviewResults roundId={params.roundId} />;
}
