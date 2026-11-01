import { DuplicateStudentsPage } from "@/features/student-merges/components/DuplicateStudentsPage";

export default async function Page(
  props: {
    searchParams: Promise<{ student?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return <DuplicateStudentsPage studentId={searchParams.student} />;
}
