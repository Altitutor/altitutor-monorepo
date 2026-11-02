import { InterviewResults } from "@/features/interviews/components/InterviewResults";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewResults id={id} />;
}
