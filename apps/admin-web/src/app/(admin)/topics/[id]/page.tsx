import { TopicDetailView } from '@/features/topics/components/TopicDetailView';

export default async function TopicDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <TopicDetailView key={params.id} id={params.id} />;
}
