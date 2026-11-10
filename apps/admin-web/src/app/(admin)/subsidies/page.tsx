import { redirect } from 'next/navigation';
import { operationalViews, operationalViewHref } from '@/features/quick-filters/config/operationalViews';

export default function LegacyPage() {
  redirect(operationalViewHref(operationalViews.subsidies));
}
