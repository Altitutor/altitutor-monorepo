import { redirect } from 'next/navigation';

export default async function TopicsPage(props: {searchParams: Promise<{view?: string}>}) {
  const searchParams = await props.searchParams;
  const id = searchParams.view;
  redirect(id && /^[0-9a-f-]{36}$/i.test(id) ? `/topics/${id}` : '/subjects');
}
