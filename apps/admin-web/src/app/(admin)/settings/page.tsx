import { redirect } from 'next/navigation';
import { firstSettingsHref } from '@/features/settings/settings-nav';

export default function SettingsIndexPage() {
  redirect(firstSettingsHref);
}
