import {
  htmlToApproxPlainText,
  looksLikeMarkdown,
  shouldPreferMarkdownPaste,
} from '../markdown-paste'

describe('looksLikeMarkdown', () => {
  it('detects headings, lists, bold, and hr from tutor docs', () => {
    const sample = `# Learning modules

**What this page is for:** Manage the UCAT app’s learning modules.

---

## Page layout

- Modules are organised in a **tree**
- Route: \`/ucat/learning-modules\`
`
    expect(looksLikeMarkdown(sample)).toBe(true)
  })

  it('returns false for plain prose', () => {
    expect(looksLikeMarkdown('Just a normal sentence without markup.')).toBe(false)
  })
})

describe('shouldPreferMarkdownPaste', () => {
  it('prefers markdown when there is only plain text', () => {
    expect(shouldPreferMarkdownPaste('# Title\n\n- item', '')).toBe(true)
  })

  it('prefers markdown for VS Code / Cursor style HTML that still shows # tokens', () => {
    const text = '# Learning modules\n\n**What this page is for:** Manage modules.'
    const html =
      '<div><span style="color:#569cd6"># Learning modules</span><br/>**What this page is for:** Manage modules.</div>'
    expect(shouldPreferMarkdownPaste(text, html)).toBe(true)
  })

  it('keeps real rich HTML from a rendered preview', () => {
    const text = 'Learning modules\n\nWhat this page is for: Manage modules.'
    const html = '<h1>Learning modules</h1><p><strong>What this page is for:</strong> Manage modules.</p>'
    expect(shouldPreferMarkdownPaste(text, html)).toBe(false)
  })

  it('does not steal image HTML pastes', () => {
    const text = '# Title'
    const html = '<h1>Title</h1><img src="https://example.com/a.png" />'
    expect(shouldPreferMarkdownPaste(text, html)).toBe(false)
  })
})

describe('htmlToApproxPlainText', () => {
  it('keeps line breaks from block tags', () => {
    expect(htmlToApproxPlainText('<div># A</div><div>- b</div>')).toContain('# A')
  })
})
