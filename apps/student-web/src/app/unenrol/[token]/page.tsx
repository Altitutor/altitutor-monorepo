import { createHash } from 'crypto';
import { redirect } from 'next/navigation';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { FormTokenClient } from '../../form/[token]/FormTokenClient';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

function MessagePage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Unable to open this form</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function UnenrolPage({ params }: { params: { token: string } }) {
  const userClient = createUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/unenrol/${params.token}`)}`);

  const admin = getServerSupabaseAdmin();
  const { data: tokenRow } = await admin
    .from('form_tokens')
    .select('id, expires_at, revoked_at')
    .eq('token_hash', hashToken(params.token))
    .maybeSingle();
  if (!tokenRow || tokenRow.revoked_at || (tokenRow.expires_at && new Date(tokenRow.expires_at) <= new Date())) {
    return <MessagePage message="This link is invalid, expired, or has been replaced." />;
  }

  const [{ data: student }, { data: exitRequest }] = await Promise.all([
    admin.from('students').select('id').eq('user_id', user.id).maybeSingle(),
    admin.from('student_exit_requests').select('student_id, status').eq('form_token_id', tokenRow.id).maybeSingle(),
  ]);
  if (!student || !exitRequest || exitRequest.student_id !== student.id) {
    return <MessagePage message="This form link belongs to another student. Sign in with the account that received the link." />;
  }
  if (exitRequest.status !== 'pending') {
    return <MessagePage message="This exit request has already been completed or is no longer active." />;
  }

  return <FormTokenClient token={params.token} />;
}
