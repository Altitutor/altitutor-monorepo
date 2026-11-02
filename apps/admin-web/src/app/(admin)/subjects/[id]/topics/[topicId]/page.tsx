import { TopicDetailView } from '@/features/topics/components/TopicDetailView';

export default async function SubjectTopicDetailPage(props: { params: Promise<{ id: string; topicId: string }> }) {
  const params = await props.params;
  return <TopicDetailView key={params.topicId} id={params.topicId} subjectId={params.id} />;
}
