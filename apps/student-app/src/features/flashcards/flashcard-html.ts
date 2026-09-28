import { parseClozeParts } from '@altitutor/shared';

const imageTag = /<img\b[^>]*>/gi;

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

function escapedAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function storedFlashcardImagePaths(html: string): string[] {
  const paths = new Set<string>();
  for (const tag of html.match(imageTag) ?? []) {
    if (attribute(tag, 'data-storage-bucket') !== 'flashcard-images') continue;
    const path = attribute(tag, 'data-storage-path');
    if (path) paths.add(path);
  }
  return [...paths];
}

export function replaceFlashcardImageUrls(html: string, urls: Map<string, string>): string {
  return html.replace(imageTag, (tag) => {
    if (attribute(tag, 'data-storage-bucket') !== 'flashcard-images') return tag;
    const path = attribute(tag, 'data-storage-path');
    const url = path ? urls.get(path) : null;
    if (!url) return tag;
    const src = `src="${escapedAttribute(url)}"`;
    return /\bsrc\s*=\s*(["']).*?\1/i.test(tag)
      ? tag.replace(/\bsrc\s*=\s*(["']).*?\1/i, src)
      : tag.replace(/<img\b/i, `<img ${src}`);
  });
}

export function clozeHtml(text: string, activeIndex: number, showAnswer: boolean): string {
  return parseClozeParts(text, activeIndex).map((part) => {
    if (part.type === 'text') return part.text;
    if (!part.active) return part.answer;
    const value = showAnswer ? part.answer : part.hint ? `… (${part.hint})` : '…';
    return `<span class="cloze ${showAnswer ? 'answer' : 'question'}">${value}</span>`;
  }).join('');
}

export function plainFlashcardPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{c\d+::(.*?)(?:::[^}]*)?}}/g, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
