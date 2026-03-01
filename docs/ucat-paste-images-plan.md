# Paste images into UCAT rich text – research and plan

## Research summary

### Does Tiptap have a built-in or recommended way?

- **No** built-in “paste image and upload” behaviour. Two options:
  1. **FileHandler extension** (`@tiptap/extension-file-handler`): `onPaste(editor, files, htmlContent)`. You get `files` and optional `htmlContent`; you handle upload and insertion. Paste position is not passed; use `editor.state.selection.from`. Adds a dependency.
  2. **ProseMirror `handlePaste`** (in `editorProps`): Use `event.clipboardData.items`, filter by `item.type.startsWith('image/')`, get `File` with `item.getAsFile()`. Return `true` to handle the paste (and prevent default). Insert at `view.state.selection.from`. No new dependency; we already use `handlePaste` for mentions.

**Recommendation:** Use **`handlePaste`** so we don’t add a dependency and so image paste runs in the same place as our existing paste logic (mentions). Insertion at cursor is exactly “image in the middle of text”.

### How do different sources put images on the clipboard?

- **Screenshot / “Copy image” from Finder:** Usually a single `image/png` (or on Mac sometimes `image/tiff`) in `clipboardData.items`. No HTML.
- **Google Docs / Word** (selection that includes an image): Often both `text/html` and one or more image files (`image/png`, on Mac sometimes `image/tiff`) in `items`. So we see both HTML and image files.
- **PDF on Mac** (copy graphic/image): Often `image/tiff` or `image/png` in `items`.

So we should treat any `item.kind === 'file'` and `item.type.startsWith('image/')`, and get the file with `item.getAsFile()`. Supporting png, jpeg, gif, webp, tiff covers Docs, Word, and PDF.

### “Image in the middle of text”

Paste happens at the **current selection** (cursor). So if the cursor is between two words, we insert the pasted image(s) at that position. No extra “paste position” is needed; we use `editor.state.selection.from`.

### Mixed paste (text + image from Word/Docs)

If we handle the image and return `true`, we **prevent default** paste, so the HTML/text is not inserted—only our uploaded images are. So “paste paragraph with image” would currently result in only the image(s) being inserted. Supporting “paste text and replace inline images with uploaded URLs” would mean parsing pasted HTML and replacing `<img>` srcs; that’s a possible follow-up. This plan only implements “when the clipboard contains image files, upload and insert them at the cursor”.

---

## Implementation plan

1. **Shared editor (`packages/ui`)**
   - Add optional prop: `onPasteImages?: (editor: Editor, files: File[]) => void`.
   - In `editorProps.handlePaste`: first check `event.clipboardData?.items` for image files (`item.kind === 'file'` and `item.type.startsWith('image/')`), collect `File[]`. If `files.length > 0` and `onPasteImages` is set, call `onPasteImages(editor, files)` and return `true`. Otherwise run existing mention paste logic.

2. **UCAT editor (`UcatRichTextEditor`)**
   - Extract a shared helper that takes `(editor, files, insertPos)` and does: optional “max 1 image” cleanup, then for each file: insert placeholder at `insertPos`, upload, replace placeholder with image (or remove on error), advance `insertPos`. Reuse the same placeholder/replace logic as drop.
   - Use this helper in `handleDrop` (insertPos from drop coords) and in a new `onPasteImages` (insertPos = `editor.state.selection.from`).
   - Pass `onPasteImages` to `RichTextEditor` when `enableImages !== false`.

3. **MIME types**
   - Allow any `image/*` (png, jpeg, gif, webp, tiff) so Google Docs, Word, and PDF on Mac are covered.

4. **No FileHandler for now**
   - Rely on `handlePaste` only; no new dependency. FileHandler can be added later if we want a single API for paste and drop.
