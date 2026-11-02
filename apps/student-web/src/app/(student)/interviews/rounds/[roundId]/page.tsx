import { StudentInterviewRoom } from "@/features/interviews/components/student-interview-room";

export default async function InterviewRoomPage(
  props: {
    params: Promise<{ roundId: string }>;
  }
) {
  const params = await props.params;
  return <StudentInterviewRoom roundId={params.roundId} />;
}
