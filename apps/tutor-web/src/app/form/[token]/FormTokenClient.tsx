'use client';

import { useEffect, useState } from 'react';
import { FormAnswerer, Spinner } from '@altitutor/ui';
import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';

export function FormTokenClient({ token }: { token: string }) {
  const [form, setForm] = useState<{
    name: string;
    blocks: FormBlock[];
    thankYouMessage: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forms/token/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Could not load form');
        setForm(json.form);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const submit = async (answers: FormAnswerPayload) => {
    const res = await fetch(`/api/forms/token/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Could not submit form');
  };

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-destructive">{error}</div>;
  }
  if (!form) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }
  return (
    <FormAnswerer
      title={form.name}
      blocks={form.blocks}
      thankYouMessage={form.thankYouMessage}
      onSubmit={submit}
    />
  );
}
