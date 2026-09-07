import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMarketingLandingUrl } from '@/shared/lib/marketing-home-url';

export default async function AppEntryRedirect() {
  const host = (await headers()).get('host') ?? undefined;
  redirect(getMarketingLandingUrl(host));
}
