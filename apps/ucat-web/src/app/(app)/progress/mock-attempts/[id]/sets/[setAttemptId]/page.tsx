import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; setAttemptId: string }>;
};

/** Legacy flat set-in-mock URL — jump to the nested mock attempt page. */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  redirect(`/progress/mocks/mock-attempts/${id}`);
}
