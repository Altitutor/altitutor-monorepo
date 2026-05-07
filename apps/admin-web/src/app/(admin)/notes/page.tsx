import { redirect } from 'next/navigation';

export default function LegacyNotesIndexRedirect() {
  redirect('/documents');
}
