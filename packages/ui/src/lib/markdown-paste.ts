/**
 * Heuristics for when clipboard plain text should be parsed as Markdown
 * instead of inserted as literal characters / syntax-highlighted HTML
 * (e.g. paste from VS Code / Cursor `.md` files).
 */

const MARKDOWN_HEADING = /^#{1,6}\s/m
const MARKDOWN_LIST = /^(\s{0,3}[-*+]|\s{0,3}\d+\.)\s/m
const MARKDOWN_BOLD = /\*\*[^*]+\*\*|__[^_]+__/
const MARKDOWN_LINK = /\[[^\]]+\]\([^)]+\)/
const MARKDOWN_CODE_FENCE = /^```/m
const MARKDOWN_INLINE_CODE = /`[^`\n]+`/
const MARKDOWN_BLOCKQUOTE = /^>\s/m
const MARKDOWN_HR = /^---$/m
const MARKDOWN_TABLE = /^\|.+\|/m

/** True when plain text looks like Markdown source. */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false

  return (
    MARKDOWN_HEADING.test(trimmed) ||
    MARKDOWN_LIST.test(trimmed) ||
    MARKDOWN_BOLD.test(trimmed) ||
    MARKDOWN_LINK.test(trimmed) ||
    MARKDOWN_CODE_FENCE.test(trimmed) ||
    MARKDOWN_INLINE_CODE.test(trimmed) ||
    MARKDOWN_BLOCKQUOTE.test(trimmed) ||
    MARKDOWN_HR.test(trimmed) ||
    MARKDOWN_TABLE.test(trimmed)
  )
}

/** Strip tags to approximate visible clipboard text from HTML. */
export function htmlToApproxPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
}

const RICH_HTML_STRUCTURE =
  /<(?:h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|blockquote)\b/i

/**
 * Prefer Markdown parse when plain text is Markdown and the HTML (if any)
 * still looks like code-editor syntax highlighting rather than real rich HTML.
 */
export function shouldPreferMarkdownPaste(text: string, html: string): boolean {
  if (!looksLikeMarkdown(text)) return false
  if (!html.trim()) return true

  // Image-heavy HTML should keep the HTML/image paste path.
  if (/<img\b/i.test(html)) return false

  const htmlText = htmlToApproxPlainText(html)
  const htmlStillHasMarkdownTokens =
    MARKDOWN_HEADING.test(htmlText) ||
    MARKDOWN_BOLD.test(htmlText) ||
    MARKDOWN_LIST.test(htmlText) ||
    MARKDOWN_INLINE_CODE.test(htmlText) ||
    MARKDOWN_HR.test(htmlText)

  // Real rich paste (Word, Docs, rendered preview) has structure tags and
  // usually no leftover `#` / `**` tokens in the visible text.
  if (RICH_HTML_STRUCTURE.test(html) && !htmlStillHasMarkdownTokens) {
    return false
  }

  return htmlStillHasMarkdownTokens || !RICH_HTML_STRUCTURE.test(html)
}
