import { redirect } from 'next/navigation';

export default function AdminShiftsPage() {
  redirect('/classes?view=calendar&show_admin_shifts=1');
}
