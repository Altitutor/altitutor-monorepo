import { redirect } from 'next/navigation';

export default function LegacyPage() {
  redirect('/students?sort=time_since_last_check_in&order=desc&columns=student,last_check_in,time_since_last_check_in');
}
