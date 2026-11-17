import { InterviewStudentsPage } from "@/features/interviews/components/InterviewStudentsPage";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewStudentsPage studentId={id} />;
}
