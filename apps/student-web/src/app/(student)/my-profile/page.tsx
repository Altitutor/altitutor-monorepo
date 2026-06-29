import { redirect } from 'next/navigation';

type MyProfileRedirectPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function MyProfileRedirectPage({ searchParams }: MyProfileRedirectPageProps) {
  const params = await searchParams;
  const tab = params.tab?.trim();

  if (tab) {
    redirect(`/settings/profile?tab=${encodeURIComponent(tab)}`);
  }

  redirect('/settings/profile');
}
