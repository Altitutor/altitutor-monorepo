import { redirect } from "next/navigation";
import { SetDetailPage } from "@/features/sets";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";

type PageProps = {
  params: Promise<{ setId: string }>;
};

export default async function SetGeneratorSetDetailRoute({
  params,
}: PageProps) {
  if (!isSetGeneratorEnabled()) {
    redirect("/sets");
  }

  const { setId } = await params;
  return (
    <SetDetailPage
      setId={setId}
      backHref="/sets/set-generator"
      backLabel="Back to set generator"
    />
  );
}
