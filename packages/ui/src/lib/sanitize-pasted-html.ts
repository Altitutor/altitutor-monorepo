const INLINE_KEEP = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'BR']);
const TABLE_KEEP = new Set([
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'TR',
  'TD',
  'TH',
  'COLGROUP',
  'COL',
]);
const TABLE_CELL_ATTRS = new Set(['colspan', 'rowspan']);

function isBoldStyle(style: string): boolean {
  return /font-weight:\s*(bold|[5-9]00)/i.test(style);
}

function isItalicStyle(style: string): boolean {
  return /font-style:\s*italic/i.test(style);
}

function isUnderlineStyle(style: string): boolean {
  return /text-decoration(?:-line)?:\s*underline/i.test(style);
}

function sanitizeChildren(parent: Element, doc: Document, out: Node): void {
  for (const child of Array.from(parent.childNodes)) {
    const sanitized = sanitizeNode(child, doc);
    if (!sanitized) continue;
    if (sanitized instanceof DocumentFragment) {
      while (sanitized.firstChild) {
        out.appendChild(sanitized.firstChild);
      }
    } else {
      out.appendChild(sanitized);
    }
  }
}

function wrapWithMarks(
  doc: Document,
  content: DocumentFragment,
  bold: boolean,
  italic: boolean,
  underline: boolean
): Node {
  let node: Node = content;
  if (underline) {
    const u = doc.createElement('u');
    u.appendChild(node);
    node = u;
  }
  if (italic) {
    const em = doc.createElement('em');
    em.appendChild(node);
    node = em;
  }
  if (bold) {
    const strong = doc.createElement('strong');
    strong.appendChild(node);
    node = strong;
  }
  return node;
}

function sanitizeNode(node: Node, doc: Document): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as Element;
  const tag = el.tagName;

  if (tag === 'SPAN' || tag === 'FONT') {
    const style = el.getAttribute('style') ?? '';
    const bold = isBoldStyle(style);
    const italic = isItalicStyle(style);
    const underline = isUnderlineStyle(style);
    const fragment = doc.createDocumentFragment();
    sanitizeChildren(el, doc, fragment);
    if (!fragment.hasChildNodes()) return null;
    if (bold || italic || underline) {
      return wrapWithMarks(doc, fragment, bold, italic, underline);
    }
    return fragment;
  }

  if (tag === 'IMG') {
    const src = el.getAttribute('src') ?? '';
    if (!src) return null;
    const clone = doc.createElement('img');
    clone.setAttribute('src', src);
    const alt = el.getAttribute('alt');
    if (alt) clone.setAttribute('alt', alt);
    const title = el.getAttribute('title');
    if (title) clone.setAttribute('title', title);
    const fileId = el.getAttribute('data-file-id');
    if (fileId) clone.setAttribute('data-file-id', fileId);
    return clone;
  }

  if (INLINE_KEEP.has(tag)) {
    const clone = doc.createElement(tag.toLowerCase());
    sanitizeChildren(el, doc, clone);
    return clone.hasChildNodes() || tag === 'BR' ? clone : null;
  }

  if (TABLE_KEEP.has(tag)) {
    const clone = doc.createElement(tag.toLowerCase());
    const allowedAttrs = tag === 'TD' || tag === 'TH' ? TABLE_CELL_ATTRS : undefined;
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (allowedAttrs?.has(name)) {
        clone.setAttribute(name, attr.value);
      }
    }
    sanitizeChildren(el, doc, clone);
    return clone;
  }

  if (tag === 'P' || tag === 'DIV') {
    const p = doc.createElement('p');
    sanitizeChildren(el, doc, p);
    return p.hasChildNodes() ? p : null;
  }

  if (tag === 'LI') {
    const p = doc.createElement('p');
    sanitizeChildren(el, doc, p);
    return p.hasChildNodes() ? p : null;
  }

  if (tag === 'UL' || tag === 'OL') {
    const fragment = doc.createDocumentFragment();
    sanitizeChildren(el, doc, fragment);
    return fragment.hasChildNodes() ? fragment : null;
  }

  if (/^H[1-6]$/.test(tag)) {
    const p = doc.createElement('p');
    sanitizeChildren(el, doc, p);
    return p.hasChildNodes() ? p : null;
  }

  // Unwrap unknown elements (a, u, mark, sub, sup, etc.) but preserve children.
  const fragment = doc.createDocumentFragment();
  sanitizeChildren(el, doc, fragment);
  return fragment.hasChildNodes() ? fragment : null;
}

/**
 * Strips rich-text paste noise (font size, color, highlight, classes) while keeping
 * bold, italic, underline, images, paragraph structure, and table markup.
 */
export function sanitizePastedHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const fragment = doc.createDocumentFragment();
    sanitizeChildren(body, doc, fragment);
    const container = doc.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
  } catch {
    return html;
  }
}

/** Removes all tables, flattening cell contents into block elements. */
export function stripAllTablesFromHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    body.querySelectorAll('table').forEach((table) => {
      const fragment = doc.createDocumentFragment();
      table.querySelectorAll('td, th').forEach((cell) => {
        const content = (cell as HTMLElement).innerHTML.trim();
        if (content) {
          const div = doc.createElement('div');
          div.innerHTML = content;
          fragment.appendChild(div);
        }
      });
      table.replaceWith(fragment);
    });
    return body.innerHTML;
  } catch {
    return html;
  }
}

/** Sanitize paste noise then apply table behaviour (strip_all removes all tables). */
export function transformPastedHtmlForBulkImport(
  html: string,
  options: {
    pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep';
  }
): string {
  let result = sanitizePastedHtml(html);
  if (options.pasteTableBehavior === 'strip_all') {
    result = stripAllTablesFromHtml(result);
  } else if (options.pasteTableBehavior === 'strip_outside') {
    result = stripOuterTablesFromSanitizedHtml(result);
  }
  return result;
}

function stripOuterTablesFromSanitizedHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const tables = body.querySelectorAll('table');
    for (const table of tables) {
      if ((table.parentElement as Element)?.closest?.('table')) continue;
      const fragment = doc.createDocumentFragment();
      const rows = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td, :scope > th');
        for (const cell of cells) {
          const content = (cell as HTMLElement).innerHTML.trim();
          if (content) {
            const div = doc.createElement('div');
            div.innerHTML = content;
            fragment.appendChild(div);
          }
        }
      }
      table.replaceWith(fragment);
    }
    return body.innerHTML;
  } catch {
    return html;
  }
}
