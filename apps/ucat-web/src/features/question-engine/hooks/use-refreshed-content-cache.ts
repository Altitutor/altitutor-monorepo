"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionItem } from "@/features/question-engine/model/types";
import {
  collectUcatImageRefsFromDocs,
  collectUcatImageRefsFromDoc,
  applySignedUrlsToDoc,
  extractImageUrlsFromDoc,
  docStructureFingerprint,
  cacheSignedUrls,
} from "@/features/question-engine/lib/refresh-ucat-image-urls";

const WINDOW_RADIUS = 4;

function normalizeDoc(json: Record<string, unknown>): Record<string, unknown> {
  if (json.type === "doc" && Array.isArray(json.content)) {
    return json;
  }
  return {
    type: "doc",
    content: Array.isArray(json.content) ? json.content : [json],
  };
}

export type CachedContent = {
  stem: Record<string, unknown> | null;
  question: Record<string, unknown> | null;
};

function questionContentVersion(q: QuestionItem): string {
  const parts: string[] = [];
  if (q.stemJson != null && typeof q.stemJson === "object") {
    const doc = normalizeDoc(q.stemJson as Record<string, unknown>);
    parts.push(`s:${docStructureFingerprint(doc)}`);
    const refs = collectUcatImageRefsFromDoc(doc);
    parts.push(`si:${refs.paths.join(",")}:${refs.fileIds.join(",")}`);
  }
  if (q.questionJson != null && typeof q.questionJson === "object") {
    const doc = normalizeDoc(q.questionJson as Record<string, unknown>);
    parts.push(`q:${docStructureFingerprint(doc)}`);
    const refs = collectUcatImageRefsFromDoc(doc);
    parts.push(`qi:${refs.paths.join(",")}:${refs.fileIds.join(",")}`);
  }
  for (const option of q.options) {
    if (option.textJson != null && typeof option.textJson === "object") {
      const doc = normalizeDoc(option.textJson as Record<string, unknown>);
      parts.push(`o:${option.id}:${docStructureFingerprint(doc)}`);
    }
  }
  return parts.join("|");
}

/**
 * Preloads refreshed content and images for a rolling window of questions.
 * Uses current ± WINDOW_RADIUS; for small sets (≤15) preloads all.
 */
export function useRefreshedContentCache(
  questions: QuestionItem[],
  currentIndex: number,
): (questionId: string) => CachedContent | null {
  const [cache, setCache] = useState<Map<string, CachedContent>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const cacheRef = useRef(cache);
  const contentVersionsRef = useRef<Map<string, string>>(new Map());
  cacheRef.current = cache;

  useEffect(() => {
    if (questions.length === 0) return;

    const preloadAll = questions.length <= 15;
    const start = preloadAll ? 0 : Math.max(0, currentIndex - WINDOW_RADIUS);
    const end = preloadAll
      ? questions.length - 1
      : Math.min(questions.length - 1, currentIndex + WINDOW_RADIUS);

    const toLoad = questions.slice(start, end + 1);
    const toFetch = toLoad.filter((q) => {
      const version = questionContentVersion(q);
      const cachedVersion = contentVersionsRef.current.get(q.id);
      if (cachedVersion === version && cacheRef.current.has(q.id)) {
        return false;
      }
      return !loadingRef.current.has(q.id);
    });
    if (toFetch.length === 0) return;

    for (const q of toFetch) {
      loadingRef.current.add(q.id);
    }

    const docs = toFetch.map((q) => ({
      stem:
        q.stemJson != null && typeof q.stemJson === "object"
          ? normalizeDoc(q.stemJson as Record<string, unknown>)
          : null,
      question:
        q.questionJson != null && typeof q.questionJson === "object"
          ? normalizeDoc(q.questionJson as Record<string, unknown>)
          : null,
    }));

    const { paths, fileIds } = collectUcatImageRefsFromDocs(docs);
    if (paths.length === 0 && fileIds.length === 0) {
      const result = new Map<string, CachedContent>();
      toFetch.forEach((q, i) => {
        result.set(q.id, {
          stem: docs[i].stem,
          question: docs[i].question,
        });
      });
      setCache((prev) => {
        const next = new Map(prev);
        result.forEach((v, k) => next.set(k, v));
        return next;
      });
      toFetch.forEach((q) => {
        contentVersionsRef.current.set(q.id, questionContentVersion(q));
      });
      toFetch.forEach((q) => loadingRef.current.delete(q.id));
      return;
    }

    fetch("/api/ucat/images/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, fileIds }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            err?.error ?? `Failed to get signed URLs: ${res.status}`,
          );
        }
        const { signedUrls } = (await res.json()) as { signedUrls: string[] };
        cacheSignedUrls(paths, fileIds, signedUrls);
        const pathToUrl = new Map(paths.map((p, i) => [p, signedUrls[i]]));
        const fileIdToUrl = new Map(
          fileIds.map((fileId, i) => [fileId, signedUrls[paths.length + i]]),
        );

        const result = new Map<string, CachedContent>();
        const urlsToPreload: string[] = [];

        toFetch.forEach((q, i) => {
          const stemDoc = docs[i].stem;
          const questionDoc = docs[i].question;
          const stem =
            stemDoc != null
              ? applySignedUrlsToDoc(stemDoc, pathToUrl, fileIdToUrl)
              : null;
          const question =
            questionDoc != null
              ? applySignedUrlsToDoc(questionDoc, pathToUrl, fileIdToUrl)
              : null;
          result.set(q.id, { stem, question });
          if (stem) urlsToPreload.push(...extractImageUrlsFromDoc(stem));
          if (question)
            urlsToPreload.push(...extractImageUrlsFromDoc(question));
        });

        urlsToPreload.forEach((url) => {
          const img = new Image();
          img.src = url;
        });

        setCache((prev) => {
          const next = new Map(prev);
          result.forEach((v, k) => next.set(k, v));
          return next;
        });
        toFetch.forEach((q) => {
          contentVersionsRef.current.set(q.id, questionContentVersion(q));
        });
      })
      .catch(() => {
        // On error, don't cache - RichContentBlock will fall back to on-demand refresh
      })
      .finally(() => {
        toFetch.forEach((q) => loadingRef.current.delete(q.id));
      });
  }, [questions, currentIndex]);

  return (questionId: string) => cache.get(questionId) ?? null;
}
