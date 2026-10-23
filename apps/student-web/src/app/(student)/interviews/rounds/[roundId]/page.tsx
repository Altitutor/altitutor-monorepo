import { StudentInterviewRoom } from "@/features/interviews/components/student-interview-room";

export default function InterviewRoomPage({
  params,
}: {
  params: { roundId: string };
}) {
  return <StudentInterviewRoom roundId={params.roundId} />;
}
