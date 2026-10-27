import { InterviewWorkspace } from "@/features/interviews/components/InterviewWorkspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewWorkspace id={id} />;
}
