import { TopicDetailView } from '@/features/topics/components/TopicDetailView';

export default function SubjectTopicDetailPage({ params }: { params: { id: string; topicId: string } }) {
  return <TopicDetailView key={params.topicId} id={params.topicId} subjectId={params.id} />;
}
