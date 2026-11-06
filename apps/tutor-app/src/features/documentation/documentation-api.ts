import type { Json } from '@altitutor/shared';

import { supabase } from '@/lib/supabase';

import { collectDocumentImages } from './document-content';
import { buildDocumentationTree, type DocumentationFolder, type DocumentationSummary } from './documentation-tree';

export async function getDocumentationTree() {
  const [folders, documents] = await Promise.all([
    supabase.from('vtutor_documentation_folders').select('id, name, parent_id'),
    supabase.from('vtutor_documentation_documents')
      .select('id, title, folder_id')
      .eq('is_tutor_documentation', true),
  ]);

  if (folders.error) throw new Error(folders.error.message);
  if (documents.error) throw new Error(documents.error.message);

  return buildDocumentationTree(
    folders.data.filter((row): row is DocumentationFolder => Boolean(row.id)),
    documents.data.filter((row): row is DocumentationSummary => Boolean(row.id)),
  );
}

export async function getDocumentationDocument(documentId: string) {
  const { data, error } = await supabase
    .from('vtutor_documentation_documents')
    .select('id, title, content')
    .eq('id', documentId)
    .eq('is_tutor_documentation', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function signDocumentationImages(content: Json) {
  const entries = await Promise.all(collectDocumentImages(content).map(async ({ bucket, path, key }) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3_600);
    return data ? [[key, data.signedUrl] as const] : [];
  }));
  return new Map(entries.flat());
}
