import { InterviewBuilder } from "@/features/interviews/components/InterviewBuilder";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewBuilder id={id} />;
}
