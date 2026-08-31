import { AccountClassBadge } from '@altitutor/ui';
import { fetchUcatStudentIdentity } from '@/features/ucat/students/lib/fetch-student-name';

export default async function UcatStudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await fetchUcatStudentIdentity(id);

  return (
    <>
      {student?.account_class === 'internal_test' ? (
        <div className="px-5 pt-6 sm:px-6">
          <AccountClassBadge accountClass={student.account_class} />
        </div>
      ) : null}
      {children}
    </>
  );
}
