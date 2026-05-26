import { useRouter } from 'expo-router';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { useResourceSubjects } from '@/hooks/use-student-data';

export default function ResourcesScreen() {
  const router = useRouter();
  const subjects = useResourceSubjects();

  return (
    <StudentScreen title="Resources" subtitle="Browse files by subject and topic.">
      {subjects.isPending ? <LoadingBlock label="Loading subjects..." /> : null}
      {subjects.isError ? <ErrorBlock message={subjects.error.message} /> : null}
      {subjects.data?.length === 0 ? <EmptyBlock>No subject resources available.</EmptyBlock> : null}
      {subjects.data?.map((subject) => (
        <Card key={subject.id}>
          <TappableRow
            title={subject.name ?? 'Subject'}
            detail={[subject.curriculum, subject.level].filter(Boolean).join(' · ')}
            accent={subject.color}
            onPress={subject.id ? () => router.push({ pathname: '/(tabs)/resources/[subjectId]', params: { subjectId: subject.id!, title: subject.name ?? 'Resources' } }) : undefined}
          />
        </Card>
      ))}
    </StudentScreen>
  );
}
