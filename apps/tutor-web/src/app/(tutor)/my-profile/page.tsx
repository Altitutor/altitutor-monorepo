import { redirect } from 'next/navigation';

export default function MyProfileRedirectPage() {
  redirect('/settings/profile');
}
