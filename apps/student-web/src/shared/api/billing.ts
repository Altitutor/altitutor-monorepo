export async function requestCardSetup(studentId: string, email?: string, name?: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/card-setup`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, email, name }),
  });
  if (!res.ok) throw new Error('Failed to initialize card setup');
  return res.json() as Promise<{ client_secret: string; payment_intent_id: string }>;
}



