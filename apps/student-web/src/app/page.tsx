import { redirect } from 'next/navigation';
import { MARKETING_LANDING_URL } from '@/shared/lib/marketing-home-url';

export default function AppEntryRedirect() {
  redirect(MARKETING_LANDING_URL);
}
