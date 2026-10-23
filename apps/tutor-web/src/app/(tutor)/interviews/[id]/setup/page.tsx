import { InterviewRoundSetup } from "@/features/interviews/components/InterviewRoundSetup";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewRoundSetup id={id} />;
}
