import { redirect } from 'next/navigation';

interface BookingLinkPageProps {
  params: Promise<{ token: string }>;
}

export default async function BookingLinkPage({ params }: BookingLinkPageProps) {
  const { token } = await params;
  redirect(`/booking-success?sessionId=${encodeURIComponent(token)}`);
}
