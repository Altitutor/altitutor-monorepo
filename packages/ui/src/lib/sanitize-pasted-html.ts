const INLINE_KEEP = new Set(['EM', 'I', 'U', 'BR'])
const SEMANTIC_BOLD = new Set(['STRONG', 'B'])
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
])
const LIST_KEEP = new Set(['UL', 'OL'])
const BLOCK_WITH_STYLE = new Set(['P', 'DIV', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
const TABLE_CELL_ATTRS = new Set(['colspan', 'rowspan'])

function isNormalWeightStyle(style: string): boolean {
  return (
    /(?:^|;)\s*font-weight\s*:\s*(normal|400)\b/i.test(style) ||
    /(?:^|;)\s*mso-ansi-font-weight\s*:\s*normal\b/i.test(style) ||
    /(?:^|;)\s*mso-bidi-font-weight\s*:\s*normal\b/i.test(style)
  )
}

function isBoldStyle(style: string): boolean {
  if (isNormalWeightStyle(style)) return false
  return (
    /(?:^|;)\s*font-weight\s*:\s*(bold|bolder|[5-9]00)\b/i.test(style) ||
    /(?:^|;)\s*mso-ansi-font-weight\s*:\s*bold\b/i.test(style) ||
    /(?:^|;)\s*mso-bidi-font-weight\s*:\s*bold\b/i.test(style)
  )
}

function isItalicStyle(style: string): boolean {
  return (
    /(?:^|;)\s*font-style\s*:\s*italic\b/i.test(style) ||
    /(?:^|;)\s*mso-ansi-font-style\s*:\s*italic\b/i.test(style)
  )
}

function isUnderlineStyle(style: string): boolean {
  return /(?:^|;)\s*text-decoration(?:-line)?\s*:\s*[^;]*\bunderline\b/i.test(style)
}

function extractIndentStyle(style: string): string | null {
  const marginLeft = style.match(/(?:^|;)\s*margin-left\s*:\s*([^;]+)/i)?.[1]
  const textIndent = style.match(/(?:^|;)\s*text-indent\s*:\s*([^;]+)/i)?.[1]
  const parts: string[] = []
  if (marginLeft?.trim()) parts.push(`margin-left:${marginLeft.trim()}`)
  if (textIndent?.trim()) parts.push(`text-indent:${textIndent.trim()}`)
  return parts.length > 0 ? parts.join(';') : null
}

function sanitizeChildren(parent: Element, doc: Document, out: Node): void {
  for (const child of Array.from(parent.childNodes)) {
    const sanitized = sanitizeNode(child, doc)
    if (!sanitized) continue
    if (sanitized instanceof DocumentFragment) {
      while (sanitized.firstChild) {
        out.appendChild(sanitized.firstChild)
      }
    } else {
      out.appendChild(sanitized)
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
  let node: Node = content
  if (underline) {
    const u = doc.createElement('u')
    u.appendChild(node)
    node = u
  }
  if (italic) {
    const em = doc.createElement('em')
    em.appendChild(node)
    node = em
  }
  if (bold) {
    const strong = doc.createElement('strong')
    strong.appendChild(node)
    node = strong
  }
  return node
}

function blockTagForElement(tag: string): string {
  if (/^H[1-6]$/.test(tag)) return 'p'
  if (tag === 'DIV') return 'p'
  if (tag === 'LI') return 'li'
  return tag.toLowerCase()
}

function sanitizeStyledBlock(el: Element, doc: Document): Node | DocumentFragment | null {
  const tag = el.tagName
  const style = el.getAttribute('style') ?? ''
  const bold = isBoldStyle(style)
  const italic = isItalicStyle(style)
  const underline = isUnderlineStyle(style)
  const indentStyle = extractIndentStyle(style)
  const fragment = doc.createDocumentFragment()
  sanitizeChildren(el, doc, fragment)
  if (!fragment.hasChildNodes()) return null

  let content: Node = fragment
  if (bold || italic || underline) {
    content = wrapWithMarks(doc, fragment, bold, italic, underline)
  }

  const block = doc.createElement(blockTagForElement(tag))
  block.appendChild(content)
  if (indentStyle) block.setAttribute('style', indentStyle)
  return block
}

function sanitizeNode(node: Node, doc: Document): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const el = node as Element
  const tag = el.tagName

  if (tag === 'SPAN' || tag === 'FONT') {
    const style = el.getAttribute('style') ?? ''
    const bold = isBoldStyle(style)
    const italic = isItalicStyle(style)
    const underline = isUnderlineStyle(style)
    const fragment = doc.createDocumentFragment()
    sanitizeChildren(el, doc, fragment)
    if (!fragment.hasChildNodes()) return null
    if (bold || italic || underline) {
      return wrapWithMarks(doc, fragment, bold, italic, underline)
    }
    return fragment
  }

  if (SEMANTIC_BOLD.has(tag)) {
    const style = el.getAttribute('style') ?? ''
    const fragment = doc.createDocumentFragment()
    sanitizeChildren(el, doc, fragment)
    if (!fragment.hasChildNodes()) return null
    if (isNormalWeightStyle(style)) return fragment
    const clone = doc.createElement(tag.toLowerCase())
    while (fragment.firstChild) {
      clone.appendChild(fragment.firstChild)
    }
    return clone
  }

  if (INLINE_KEEP.has(tag)) {
    const clone = doc.createElement(tag.toLowerCase())
    sanitizeChildren(el, doc, clone)
    return clone.hasChildNodes() || tag === 'BR' ? clone : null
  }

  if (tag === 'IMG') {
    const src = el.getAttribute('src') ?? ''
    if (!src) return null
    const clone = doc.createElement('img')
    clone.setAttribute('src', src)
    const alt = el.getAttribute('alt')
    if (alt) clone.setAttribute('alt', alt)
    const title = el.getAttribute('title')
    if (title) clone.setAttribute('title', title)
    const fileId = el.getAttribute('data-file-id')
    if (fileId) clone.setAttribute('data-file-id', fileId)
    return clone
  }

  if (TABLE_KEEP.has(tag)) {
    const cellTag = tag === 'TH' ? 'td' : tag.toLowerCase()
    const clone = doc.createElement(cellTag)
    const allowedAttrs = tag === 'TD' || tag === 'TH' ? TABLE_CELL_ATTRS : undefined
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (allowedAttrs?.has(name)) {
        clone.setAttribute(name, attr.value)
      }
    }
    const style = el.getAttribute('style') ?? ''
    const bold = isBoldStyle(style)
    const italic = isItalicStyle(style)
    const underline = isUnderlineStyle(style)
    const fragment = doc.createDocumentFragment()
    sanitizeChildren(el, doc, fragment)
    if (!fragment.hasChildNodes()) return clone
    let content: Node = fragment
    if (bold || italic || underline) {
      content = wrapWithMarks(doc, fragment, bold, italic, underline)
    }
    clone.appendChild(content)
    return clone
  }

  if (LIST_KEEP.has(tag)) {
    const clone = doc.createElement(tag.toLowerCase())
    sanitizeChildren(el, doc, clone)
    return clone.hasChildNodes() ? clone : null
  }

  if (tag === 'LI') {
    return sanitizeStyledBlock(el, doc)
  }

  if (BLOCK_WITH_STYLE.has(tag)) {
    return sanitizeStyledBlock(el, doc)
  }

  // Unwrap unknown elements (a, mark, sub, sup, etc.) but preserve children.
  const fragment = doc.createDocumentFragment()
  sanitizeChildren(el, doc, fragment)
  return fragment.hasChildNodes() ? fragment : null
}

/**
 * Strips rich-text paste noise (font size, color, highlight, classes) while keeping
 * bold, italic, underline, images, paragraph structure, lists, indentation, and table markup.
 */
export function sanitizePastedHtml(html: string): string {
  if (!html.trim()) return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    const fragment = doc.createDocumentFragment()
    sanitizeChildren(body, doc, fragment)
    const container = doc.createElement('div')
    container.appendChild(fragment)
    return container.innerHTML
  } catch {
    return html
  }
}

/** Removes all tables, flattening cell contents into block elements. */
export function stripAllTablesFromHtml(html: string): string {
  if (!html.trim()) return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    body.querySelectorAll('table').forEach((table) => {
      const fragment = doc.createDocumentFragment()
      table.querySelectorAll('td, th').forEach((cell) => {
        const content = (cell as HTMLElement).innerHTML.trim()
        if (content) {
          const div = doc.createElement('div')
          div.innerHTML = content
          fragment.appendChild(div)
        }
      })
      table.replaceWith(fragment)
    })
    return body.innerHTML
  } catch {
    return html
  }
}

/** Sanitize paste noise then apply table behaviour (strip_all removes all tables). */
export function transformPastedHtmlForBulkImport(
  html: string,
  options: {
    pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep'
  }
): string {
  let result = sanitizePastedHtml(html)
  if (options.pasteTableBehavior === 'strip_all') {
    result = stripAllTablesFromHtml(result)
  } else if (options.pasteTableBehavior === 'strip_outside') {
    result = stripOuterTablesFromSanitizedHtml(result)
  }
  return result
}

function stripOuterTablesFromSanitizedHtml(html: string): string {
  if (!html.trim()) return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    const tables = body.querySelectorAll('table')
    for (const table of tables) {
      if ((table.parentElement as Element)?.closest?.('table')) continue
      const fragment = doc.createDocumentFragment()
      const rows = table.querySelectorAll(':scope > tbody > tr, :scope > tr')
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td, :scope > th')
        for (const cell of cells) {
          const content = (cell as HTMLElement).innerHTML.trim()
          if (content) {
            const div = doc.createElement('div')
            div.innerHTML = content
            fragment.appendChild(div)
          }
        }
      }
      table.replaceWith(fragment)
    }
    return body.innerHTML
  } catch {
    return html
  }
}
