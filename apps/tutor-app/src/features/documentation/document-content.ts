import type { Json } from '@altitutor/shared';

type JsonObject = { [key: string]: Json | undefined };

type DocumentImage = { bucket: string; path: string; key: string };

type DocumentColors = {
  background: string;
  text: string;
  border: string;
  link: string;
};

const escapeCharacters: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => escapeCharacters[character]);
}

function object(value: Json | undefined): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function children(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function readContent(content: Json): Json {
  if (typeof content !== 'string') return content;
  try {
    return JSON.parse(content) as Json;
  } catch {
    return content;
  }
}

function imageReference(attrs: JsonObject | undefined): DocumentImage | undefined {
  const bucket = attrs?.storageBucket;
  const path = attrs?.storagePath;
  if (typeof bucket !== 'string' || typeof path !== 'string' || !bucket || !path) return undefined;
  return { bucket, path, key: JSON.stringify([bucket, path]) };
}

function webUrl(value: Json | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function documentLink(value: Json | undefined): string | undefined {
  if (typeof value === 'string' && /^(mailto:|tel:)/i.test(value)) return value;
  return webUrl(value);
}

export function collectDocumentImages(content: Json): DocumentImage[] {
  const unique = new Map<string, DocumentImage>();

  function walk(raw: Json) {
    const node = object(raw);
    if (!node) return;
    if (node.type === 'image') {
      const image = imageReference(object(node.attrs));
      if (image) unique.set(image.key, image);
    }
    children(node.content).forEach(walk);
  }

  walk(readContent(content));
  return [...unique.values()];
}

const inlineTags: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
  highlight: 'mark',
  subscript: 'sub',
  superscript: 'sup',
};

function renderText(node: JsonObject): string {
  let value = escapeHtml(typeof node.text === 'string' ? node.text : '');
  for (const rawMark of children(node.marks)) {
    const mark = object(rawMark);
    if (typeof mark?.type !== 'string') continue;
    const tag = Object.hasOwn(inlineTags, mark.type) ? inlineTags[mark.type] : undefined;
    if (tag) value = `<${tag}>${value}</${tag}>`;
    if (mark.type === 'link') {
      const href = documentLink(object(mark.attrs)?.href);
      if (href) value = `<a href="${escapeHtml(href)}">${value}</a>`;
    }
  }
  return value;
}

const blockTags: Record<string, string> = {
  paragraph: 'p',
  bulletList: 'ul',
  listItem: 'li',
  taskList: 'ul',
  blockquote: 'blockquote',
  detailsSummary: 'summary',
  detailsContent: 'div',
  tableRow: 'tr',
};

function cellSpan(attrs: JsonObject | undefined, name: 'colspan' | 'rowspan') {
  const value = attrs?.[name];
  return typeof value === 'number' && Number.isInteger(value) && value > 1 && value <= 100
    ? ` ${name}="${value}"`
    : '';
}

function renderNode(raw: Json, images: ReadonlyMap<string, string>): string {
  const node = object(raw);
  if (!node || typeof node.type !== 'string') return '';
  if (node.type === 'text') return renderText(node);

  const body = children(node.content).map((child) => renderNode(child, images)).join('');
  const tag = Object.hasOwn(blockTags, node.type) ? blockTags[node.type] : undefined;
  if (tag) return `<${tag}>${body}</${tag}>`;

  const attrs = object(node.attrs);
  switch (node.type) {
    case 'heading':
    case 'collapsibleHeading': {
      const level = typeof attrs?.level === 'number' && Number.isInteger(attrs.level) && attrs.level >= 1 && attrs.level <= 6
        ? attrs.level
        : 2;
      return `<h${level}>${body}</h${level}>`;
    }
    case 'orderedList': {
      const start = typeof attrs?.start === 'number' && Number.isSafeInteger(attrs.start) ? attrs.start : 1;
      return `<ol start="${start}">${body}</ol>`;
    }
    case 'taskItem':
      return `<li>${attrs?.checked ? '☑' : '☐'} ${body}</li>`;
    case 'codeBlock':
      return `<pre><code>${body}</code></pre>`;
    case 'horizontalRule':
      return '<hr>';
    case 'hardBreak':
      return '<br>';
    case 'details':
      return `<details${attrs?.open ? ' open' : ''}>${body}</details>`;
    case 'table':
      return `<div class="table"><table>${body}</table></div>`;
    case 'tableHeader':
    case 'tableCell': {
      const cellTag = node.type === 'tableHeader' ? 'th' : 'td';
      return `<${cellTag}${cellSpan(attrs, 'colspan')}${cellSpan(attrs, 'rowspan')}>${body}</${cellTag}>`;
    }
    case 'image': {
      const image = imageReference(attrs);
      const src = webUrl(image ? images.get(image.key) : attrs?.src);
      const alt = escapeHtml(typeof attrs?.alt === 'string' ? attrs.alt : '');
      return src ? `<img src="${escapeHtml(src)}" alt="${alt}">` : `<p>${alt || 'Image unavailable'}</p>`;
    }
    case 'externalVideo': {
      const url = webUrl(attrs?.url ?? attrs?.src);
      return url ? `<p><a href="${escapeHtml(url)}">Open video</a></p>` : body;
    }
    case 'inlineMath':
    case 'blockMath':
      return typeof attrs?.latex === 'string' ? `<code>${escapeHtml(attrs.latex)}</code>` : body;
    case 'mention':
    case 'entityMention':
      return typeof attrs?.label === 'string' ? escapeHtml(attrs.label) : body;
    default:
      return body;
  }
}

export function documentHtml(content: Json, colors: DocumentColors, images: ReadonlyMap<string, string>) {
  const parsed = readContent(content);
  const body = typeof parsed === 'string'
    ? `<p class="plain-text">${escapeHtml(parsed)}</p>`
    : renderNode(parsed, images);

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<style>
  body { margin: 0; padding: 12px 20px 40px; font: -apple-system-body; font-family: system-ui, sans-serif; line-height: 1.6; overflow-wrap: anywhere; color: ${colors.text}; background: ${colors.background}; }
  a { color: ${colors.link}; } h1,h2,h3,h4,h5,h6 { line-height: 1.25; }
  p,ul,ol,pre,blockquote { margin-block: 0 1em; }
  details { margin-block: 1em; border: 1px solid ${colors.border}; padding: 0.5em; border-radius: 8px; }
  blockquote { margin-inline: 0; padding-inline-start: 1em; border-inline-start: 3px solid ${colors.border}; }
  pre, .table { overflow-x: auto; } table { border-collapse: collapse; }
  td,th { border: 1px solid ${colors.border}; padding: 0.5em; }
  img { max-width: 100%; height: auto; } .plain-text { white-space: pre-wrap; }
</style></head><body><main>${body || '<p>This document is empty.</p>'}</main></body></html>`;
}
