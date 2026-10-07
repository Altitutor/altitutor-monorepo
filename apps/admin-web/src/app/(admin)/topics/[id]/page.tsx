import { TopicDetailView } from '@/features/topics/components/TopicDetailView';

export default function TopicDetailPage({ params }: { params: { id: string } }) {
  return <TopicDetailView key={params.id} id={params.id} />;
}
