import { InterviewRoundEntry } from "@/features/interviews/components/InterviewRoundEntry";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewRoundEntry id={id} />;
}
