import { PracticeStemPage } from "@/features/practice/components/practice-stem-page";

export default function PracticeStemRoute({
  params,
}: {
  params: { stemId: string };
}) {
  return <PracticeStemPage stemId={params.stemId} />;
}
