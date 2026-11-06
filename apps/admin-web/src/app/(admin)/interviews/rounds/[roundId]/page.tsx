import { AdminInterviewRound } from "@/features/interviews/components/AdminInterviewRound";
export default async function Page({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  return <AdminInterviewRound roundId={(await params).roundId} />;
}
