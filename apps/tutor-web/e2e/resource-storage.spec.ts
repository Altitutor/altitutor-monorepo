import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { ownedPdfDatabase } from '../../../scripts/e2e/resource-pdf';

// Exercise Storage itself: passing the resource permission RPC alone does not
// prove the SELECT policies were installed in the disposable database.
test('Student and Tutor resource signing allows entitled reads and denies other subjects', async ({ baseURL }) => {
  const admin = ownedPdfDatabase('TUTOR', baseURL);
  const bytes = readFileSync(path.resolve(__dirname, '../../../scripts/e2e/fixtures/two-page-resource.pdf'));
  const deniedTopicId = '30000000-0000-0000-0000-000000000003';
  const resources: Array<{ id: string; key: string; allowed: boolean }> = [];
  const allowedTopicId = '30000000-0000-0000-0000-000000000001';
  try {
    for (const [id, allowed] of [[allowedTopicId, true], [deniedTopicId, false]] as const) {
      const { data: topic } = await admin.from('topics').select('subject_id').eq('id', id).single().throwOnError();
      if (!topic) throw new Error('Resource fixture topic missing');
      const fileId = randomUUID();
      const filename = `storage-${fileId}.pdf`;
      const key = `${topic.subject_id}/${id}/${filename}`;
      resources.push({ id: fileId, key, allowed });
      const { error } = await admin.storage.from('resources').upload(key, bytes, { contentType: 'application/pdf' });
      if (error) throw error;
      await admin.from('files').insert({ id: fileId, filename, bucket: 'resources', storage_path: key,
        mimetype: 'application/pdf', size_bytes: bytes.length }).throwOnError();
      await admin.from('topics_files').insert({ id: fileId, file_id: fileId, topic_id: id,
        type: 'NOTES', code: `STORAGE-${fileId.slice(0, 8)}`, index: 99999 }).throwOnError();
    }
    for (const email of ['alice.williams@student.test', 'john.doe@altitutor.test']) {
      const client = createClient(process.env.TUTOR_E2E_SUPABASE_URL!, process.env.TUTOR_E2E_PUBLIC_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({ email, password: 'test-password' });
      expect(error).toBeNull();
      try {
        for (const resource of resources) {
          const { data, error: signingError } = await client.storage.from('resources').createSignedUrl(resource.key, 60);
          const { data: download, error: downloadError } = await client.storage.from('resources').download(resource.key);
          if (resource.allowed) {
            expect(signingError).toBeNull();
            expect(data?.signedUrl).toBeTruthy();
            const response = await fetch(data!.signedUrl);
            expect(response.status).toBe(200);
            expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
            expect(downloadError).toBeNull();
            expect(Buffer.from(await download!.arrayBuffer())).toEqual(bytes);
          } else {
            expect(data).toBeNull();
            expect(signingError).not.toBeNull();
            expect(download).toBeNull();
            expect(downloadError).not.toBeNull();
          }
        }
      } finally {
        await client.auth.signOut();
      }
    }
    const anonymous = createClient(process.env.TUTOR_E2E_SUPABASE_URL!, process.env.TUTOR_E2E_PUBLIC_KEY!);
    const { data, error } = await anonymous.storage.from('resources').createSignedUrl(resources[0].key, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  } finally {
    for (const resource of resources) {
      await admin.from('topics_files').delete().eq('id', resource.id).throwOnError();
      await admin.from('files').delete().eq('id', resource.id).throwOnError();
      const { error } = await admin.storage.from('resources').remove([resource.key]);
      if (error) throw error;
    }
  }
});
