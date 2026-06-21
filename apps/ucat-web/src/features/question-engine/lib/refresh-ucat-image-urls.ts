/**
 * Refreshes expired Supabase signed URLs in Tiptap JSON documents.
 * Signed URLs expire after 1 hour; this replaces them with fresh URLs when rendering.
 */

const UCAT_IMAGES_SIGNED_URL_PATTERN =
  /\/storage\/v1\/object\/sign\/ucat-images\/([^?]+)(?:\?|$)/;

/** Extracts storage path from a Supabase ucat-images signed URL, or null if not matching. */
export function extractUcatImagePathFromSignedUrl(src: string): string | null {
  if (typeof src !== "string" || !src.includes("ucat-images")) return null;
  const match = src.match(UCAT_IMAGES_SIGNED_URL_PATTERN);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Default expiry for refreshed URLs: 24 hours (covers a typical exam session). */
const REFRESHED_URL_EXPIRY_SECONDS = 86400;

type UcatImageRef =
  | { node: Record<string, unknown>; path: string; fileId?: null }
  | { node: Record<string, unknown>; path?: null; fileId: string };

/**
 * Recursively walks a Tiptap JSON document and replaces ucat-images signed URLs
 * with fresh signed URLs. Returns a deep clone with updated image srcs.
 */
export async function refreshUcatImageUrls(
  doc: Record<string, unknown>,
  createSignedUrl: (path: string) => Promise<string>,
  createSignedUrlFromFileId?: (fileId: string) => Promise<string>,
): Promise<Record<string, unknown>> {
  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  const nodesToRefresh: UcatImageRef[] = [];

  function walk(node: Record<string, unknown>): void {
    if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
      const attrs = node.attrs as Record<string, unknown>;
      const src = attrs.src;
      const fileId = attrs.fileId;
      if (typeof src === "string") {
        const path = extractUcatImagePathFromSignedUrl(src);
        if (path) {
          nodesToRefresh.push({ node, path });
          return;
        }
      }
      if (
        typeof fileId === "string" &&
        fileId.length > 0 &&
        createSignedUrlFromFileId
      ) {
        nodesToRefresh.push({ node, fileId });
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }

  walk(result);

  const freshUrls = await Promise.all(
    nodesToRefresh.map((ref) => {
      if ("path" in ref && ref.path) return createSignedUrl(ref.path);
      const fileId = ref.fileId;
      return fileId ? (createSignedUrlFromFileId?.(fileId) ?? "") : "";
    }),
  );

  for (let i = 0; i < nodesToRefresh.length; i++) {
    const attrs = nodesToRefresh[i].node.attrs as Record<string, unknown>;
    if (attrs) {
      attrs.src = freshUrls[i];
    }
  }

  return result;
}

/**
 * Applies a path->URL map to a doc (replaces image srcs). Returns a deep clone.
 * Paths not in the map are left unchanged (e.g. non-ucat URLs).
 */
export function applySignedUrlsToDoc(
  doc: Record<string, unknown>,
  pathToUrl: Map<string, string>,
  fileIdToUrl: Map<string, string> = new Map(),
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  function walk(node: Record<string, unknown>): void {
    if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
      const attrs = node.attrs as Record<string, unknown>;
      const src = attrs.src;
      if (typeof src === "string") {
        const path = extractUcatImagePathFromSignedUrl(src);
        const url = path ? pathToUrl.get(path) : undefined;
        if (url) attrs.src = url;
      }
      if (typeof attrs.fileId === "string") {
        const url = fileIdToUrl.get(attrs.fileId);
        if (url) attrs.src = url;
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }
  walk(result);
  return result;
}

export { REFRESHED_URL_EXPIRY_SECONDS };

/** Collects all unique ucat-images storage paths and file IDs from docs. */
export function collectUcatImageRefsFromDocs(
  docs: Array<{
    stem?: Record<string, unknown> | null;
    question?: Record<string, unknown> | null;
  }>,
): { paths: string[]; fileIds: string[] } {
  const paths = new Set<string>();
  const fileIds = new Set<string>();
  function walk(node: Record<string, unknown>): void {
    if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
      const attrs = node.attrs as Record<string, unknown>;
      const src = attrs.src;
      if (typeof src === "string") {
        const path = extractUcatImagePathFromSignedUrl(src);
        if (path) {
          paths.add(path);
        } else if (typeof attrs.fileId === "string" && attrs.fileId.length > 0) {
          fileIds.add(attrs.fileId);
        }
      } else if (typeof attrs.fileId === "string" && attrs.fileId.length > 0) {
        fileIds.add(attrs.fileId);
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }
  for (const d of docs) {
    if (d.stem) walk(d.stem);
    if (d.question) walk(d.question);
  }
  return { paths: [...paths], fileIds: [...fileIds] };
}

/** Extracts image URLs from a refreshed doc (walks and collects attrs.src from image nodes). */
export function extractImageUrlsFromDoc(
  doc: Record<string, unknown>,
): string[] {
  const urls: string[] = [];
  function walk(node: Record<string, unknown>): void {
    if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
      const src = (node.attrs as Record<string, unknown>).src;
      if (typeof src === "string" && src.startsWith("http")) {
        urls.push(src);
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }
  walk(doc);
  return urls;
}

/** Collects all unique ucat-images storage paths from docs. */
export function collectUcatImagePathsFromDocs(
  docs: Array<{
    stem?: Record<string, unknown> | null;
    question?: Record<string, unknown> | null;
  }>,
): string[] {
  return collectUcatImageRefsFromDocs(docs).paths;
}

/** Collects unique ucat-images storage paths and file IDs from a single Tiptap JSON document. */
export function collectUcatImageRefsFromDoc(doc: Record<string, unknown>): {
  paths: string[];
  fileIds: string[];
} {
  return collectUcatImageRefsFromDocs([{ stem: doc }]);
}

/**
 * Fingerprint of document structure for comparing TipTap JSON without volatile signed URLs.
 * Detects text/structure changes when image path keys are unchanged.
 */
export function docStructureFingerprint(
  doc: Record<string, unknown> | null | undefined,
): string {
  const parts: string[] = [];

  function walk(node: Record<string, unknown>): void {
    parts.push(String(node.type ?? ""));

    if (node.type === "image") {
      const attrs =
        node.attrs && typeof node.attrs === "object"
          ? (node.attrs as Record<string, unknown>)
          : null;
      parts.push(`img:${String(attrs?.fileId ?? attrs?.alt ?? "")}`);
      return;
    }

    if (typeof node.text === "string") {
      parts.push(`t:${node.text}`);
    }

    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }

  if (doc && typeof doc === "object") {
    walk(doc);
  }

  return parts.join("|");
}

const signedUrlByPath = new Map<string, string>();
const signedUrlByFileId = new Map<string, string>();

export function getCachedSignedUrlForPath(path: string): string | undefined {
  return signedUrlByPath.get(path);
}

export function getCachedSignedUrlForFileId(fileId: string): string | undefined {
  return signedUrlByFileId.get(fileId);
}

export function cacheSignedUrls(
  paths: string[],
  fileIds: string[],
  signedUrls: string[],
): void {
  paths.forEach((path, index) => {
    const url = signedUrls[index];
    if (url) {
      signedUrlByPath.set(path, url);
    }
  });
  fileIds.forEach((fileId, index) => {
    const url = signedUrls[paths.length + index];
    if (url) {
      signedUrlByFileId.set(fileId, url);
    }
  });
}
