import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; setAttemptId: string }>;
};

/** Legacy nested set-in-mock review URL — jump to the parent mock attempt. */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  redirect(`/progress/mocks/mock-attempts/${id}`);
}
