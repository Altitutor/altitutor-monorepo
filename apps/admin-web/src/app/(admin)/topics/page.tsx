import { redirect } from 'next/navigation';

export default function TopicsPage({searchParams}: {searchParams: {view?: string}}) {
  const id = searchParams.view;
  redirect(id && /^[0-9a-f-]{36}$/i.test(id) ? `/topics/${id}` : '/subjects');
}
