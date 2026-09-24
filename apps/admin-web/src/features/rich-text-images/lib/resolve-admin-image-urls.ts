import {
  applyAdminSignedUrlsToDoc,
  cacheAdminSignedUrls,
  collectAdminImageRefsFromDoc,
  getCachedAdminSignedUrlForFileId,
  getCachedAdminSignedUrlForPath,
} from './refresh-admin-image-urls';

export type AdminImageSignedUrlResolver = (references: {
  paths: string[];
  fileIds: string[];
}) => Promise<string[]>;

const requestSignedUrls: AdminImageSignedUrlResolver = async ({
  paths,
  fileIds,
}) => {
  const response = await fetch('/api/admin/rich-text-images/signed-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths, fileIds }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    signedUrls?: string[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      json.error ?? `Failed to get signed URLs: ${response.status}`,
    );
  }
  return json.signedUrls ?? [];
};

/** Resolves every stored admin image reference and returns a renderable clone. */
export async function resolveAdminImageUrls(
  doc: Record<string, unknown>,
  resolveSignedUrls: AdminImageSignedUrlResolver = requestSignedUrls,
): Promise<Record<string, unknown>> {
  const refs = collectAdminImageRefsFromDoc(doc);
  const missingPaths = refs.paths.filter(
    (path) => !getCachedAdminSignedUrlForPath(path),
  );
  const missingFileIds = refs.fileIds.filter(
    (fileId) => !getCachedAdminSignedUrlForFileId(fileId),
  );

  if (missingPaths.length > 0 || missingFileIds.length > 0) {
    const signedUrls = await resolveSignedUrls({
      paths: missingPaths,
      fileIds: missingFileIds,
    });
    cacheAdminSignedUrls(missingPaths, missingFileIds, signedUrls);
  }

  const pathToUrl = new Map(
    refs.paths.flatMap((path) => {
      const url = getCachedAdminSignedUrlForPath(path);
      return url ? [[path, url] as const] : [];
    }),
  );
  const fileIdToUrl = new Map(
    refs.fileIds.flatMap((fileId) => {
      const url = getCachedAdminSignedUrlForFileId(fileId);
      return url ? [[fileId, url] as const] : [];
    }),
  );
  return applyAdminSignedUrlsToDoc(doc, pathToUrl, fileIdToUrl);
}
