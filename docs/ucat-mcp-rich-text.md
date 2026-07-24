# UCAT MCP rich text

UCAT rich-text fields accept one of three inputs:

```json
"A plain unformatted paragraph."
```

```json
{
  "format": "markdown",
  "value": "## Strategy\n\n- Eliminate impossible answers\n- Estimate before calculating"
}
```

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Exact ProseMirror content" }]
    }
  ]
}
```

Prefer explicit Markdown for ordinary authoring. The server converts it to
TipTap/ProseMirror JSON before saving. Use native ProseMirror only when exact
node control or embedded images are required.

## Supported Markdown

- Headings levels 1–4
- Paragraphs
- Ordered and unordered lists
- GitHub-style pipe tables with a header separator row
- Blockquotes
- Fenced code blocks
- Horizontal rules
- Bold, italic, strikethrough, inline code, and links
- Inline formatting inside list items and table cells

Keep tables rectangular. Escaped pipe characters, nested lists, task lists,
footnotes, raw HTML blocks, Markdown image syntax, and language metadata on
code fences are not part of the supported contract. Unsupported syntax may be
preserved as literal text; use native ProseMirror JSON when it matters.

The same rich-text contract applies to lesson text-block `content.body`,
question-stem text, question text, answer text and explanations, set names and
descriptions, and mock instructions.

## Images

`generate_ucat_image`, `revise_ucat_image`, and `render_ucat_visual` return an
`imageNode` ready to insert into a native ProseMirror document:

```json
{
  "type": "image",
  "attrs": {
    "src": "https://signed-preview-url",
    "alt": "Accessible description",
    "fileId": "00000000-0000-0000-0000-000000000000"
  }
}
```

Keep `fileId`; it is the durable reference. The signed `src` is only a preview
and can be refreshed with `get_ucat_file`. Insert the node into the `content`
array of a ProseMirror document for any rich-text field. For a lesson file
block, use the returned `fileId` in the block’s `fileId` field instead.
