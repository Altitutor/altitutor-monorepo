import { redirect } from 'next/navigation';

export default function OnlineStudentsPage() {
  redirect('/students?relationship=online');
}
