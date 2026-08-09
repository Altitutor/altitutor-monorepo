import { redirect } from 'next/navigation';

interface RegistrationLinkPageProps {
  params: Promise<{ token: string }>;
}

export default async function RegistrationLinkPage({ params }: RegistrationLinkPageProps) {
  const { token } = await params;
  redirect(`/register/${encodeURIComponent(token)}`);
}
