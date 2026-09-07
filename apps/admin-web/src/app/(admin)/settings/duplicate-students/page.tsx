import { DuplicateStudentsPage } from "@/features/student-merges/components/DuplicateStudentsPage";

export default function Page({
  searchParams,
}: {
  searchParams: { student?: string };
}) {
  return <DuplicateStudentsPage studentId={searchParams.student} />;
}
