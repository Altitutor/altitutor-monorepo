import { InterviewTutorsPage } from "@/features/interviews/components/InterviewStatistics";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InterviewTutorsPage tutorId={(await params).id} />;
}
