import { redirect } from 'next/navigation';

export default function TrialStudentsPage() {
  redirect('/students?relationship=trial');
}
