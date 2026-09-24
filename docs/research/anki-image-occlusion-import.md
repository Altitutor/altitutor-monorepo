# Anki image-occlusion import feasibility

Date: 2026-08-08

## Question

Can Altitutor import cloze-image/image-occlusion flashcards from Anki, including modern native Image Occlusion and older Image Occlusion Enhanced decks, while preserving editable boxes and cloze grouping?

## Conclusion

Yes, with a deliberately bounded first release.

The best initial APKG importer is:

1. **Native Anki Image Occlusion only.** Import the built-in Image Occlusion note type introduced in Anki 23.10.
2. **Rectangle masks only.** Preserve each Anki ordinal as the Altitutor cloze number; rectangles sharing an ordinal remain one review card.
3. **Legacy-compatible APKG packages only.** Ask users to enable Anki's “Support older Anki versions” export option. This still carries current notes and media, but uses the much simpler `collection.anki21`/legacy media-map representation instead of the modern zstd/protobuf package representation. Anki officially exposes this export option and states that the modern form is faster/smaller but unreadable by older clients. ([Anki export manual](https://docs.ankiweb.net/exporting.html#deck-apkg), [Anki package metadata source](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/meta.rs))
4. **Fresh Altitutor scheduling.** Import content, not Anki scheduling or review history. APKGs can contain scheduling data, but Altitutor already owns per-review-card FSRS state and a content import should not silently adopt another scheduler's state. ([Anki packaged-deck manual](https://docs.ankiweb.net/importing/packaged-decks.html#scheduling), [`flashcard_fsrs_scheduling` migration](../../supabase/migrations/20260623173000_flashcard_fsrs_scheduling.sql))
5. **Preview before commit.** Show accepted notes, skipped notes, unsupported shapes, missing media, and destination topic before uploading images/inserting flashcards.

That scope is a medium-sized implementation, not a research project. Full transparent support for every current/older APKG variant and Image Occlusion Enhanced is materially harder and should be a later compatibility phase.

## Current Altitutor conventions

Altitutor's current flashcard model is text-cloze-specific: a flashcard has `cloze_text`, optional `extra`, and an index; review cards are generated for the distinct positive cloze indexes extracted from `{{cN::...}}` markers ([shared types](../../packages/shared/src/flashcards/types.ts), [cloze parser](../../packages/shared/src/flashcards/cloze.ts), [initial flashcard schema](../../supabase/migrations/20260623120000_topic_flashcards.sql)). Two text clozes with the same number therefore already correspond to one review card.

Admin and tutor imports currently accept pasted CSV/TSV. The shared parser supports a headered `text`/`cloze_text`, `extra`, and `order` shape, plus an Anki-style tab-separated text export, and rejects rows without a cloze marker ([CSV parser](../../packages/shared/src/flashcards/csv.ts)). Admin and tutor each expose a separate authenticated import route, but both use that shared parser and then insert topic-linked rows ([admin route](../../apps/admin-web/src/app/api/flashcards/import/route.ts), [tutor route](../../apps/tutor-web/src/app/api/flashcards/import/route.ts)).

Flashcard images already have an appropriate private storage path. Admin and tutor upload images into the private `flashcard-images` bucket, while students obtain authorized signed URLs for paths embedded in flashcard HTML ([bucket migration](../../supabase/migrations/20260624120000_flashcard_images_bucket.sql), [student URL refresh](../../apps/student-web/src/features/flashcards/lib/refresh-flashcard-image-urls.ts)). The APKG importer should reuse this storage/authentication path rather than introduce Anki media URLs.

There is currently no ZIP or SQLite parsing dependency in the workspace, and no APKG upload path. The existing import UI is pasted text, so an APKG import requires a file upload, package preview, media upload, and transactional/compensating import workflow rather than an extension to `parseFlashcardCsv` alone.

One existing security issue becomes especially important for Anki import: flashcard question and extra HTML are rendered with `dangerouslySetInnerHTML` in student review and author previews ([student review](../../apps/student-web/src/features/flashcards/components/flashcard-review-session.tsx), [admin preview](../../apps/admin-web/src/features/flashcards/components/EditFlashcardDialog.tsx), [tutor preview](../../apps/tutor-web/src/features/flashcards/components/flashcard-manager.tsx)). Imported Anki HTML must therefore be sanitized to a strict allowlist before persistence; it must not be copied verbatim.

## What an APKG contains

An `.apkg` is a packaged deck containing notes, note types, cards and, optionally, bundled media. Anki distinguishes deck packages from whole-collection packages and adds deck-package contents instead of replacing the collection. ([Anki packaged-deck manual](https://docs.ankiweb.net/importing/packaged-decks.html), [Anki export manual](https://docs.ankiweb.net/exporting.html#deck-apkg))

There are two relevant physical formats:

- Legacy packages contain `collection.anki2` or `collection.anki21`, which is an uncompressed SQLite collection, plus a `media` JSON object mapping numbered ZIP entries to original filenames. Anki's importer chooses `collection.anki21` when present, otherwise `collection.anki2`, decodes the JSON media map, normalizes filenames, and rejects paths that escape the media directory. ([legacy Python APKG importer](https://github.com/ankitects/anki/blob/main/pylib/anki/importing/apkg.py))
- Current packages contain a protobuf `meta`, a zstd-compressed `collection.anki21b` using schema 18, and a zstd-compressed protobuf media list; individual media entries may also be compressed. Anki's current source explicitly maps package versions to these filenames, compression rules, schema versions, and media-list encodings. ([package metadata](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/meta.rs), [media extraction](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/media.rs))

In legacy schema 11, the `notes` table contains a note-type ID (`mid`) and a single `flds` value. Anki splits/joins that value on U+001F; note-type definitions are stored in the collection's models JSON, which provides field order and names. ([schema 11](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql), [note field serialization](https://github.com/ankitects/anki/blob/main/rslib/src/storage/note/mod.rs))

This is why the “legacy-compatible export” boundary is valuable: a first version needs ZIP + JSON + SQLite parsing, while unrestricted modern APKG support additionally needs Anki's protobuf schemas, zstd handling, schema-18 support, and forward-compatibility policy.

## Modern native Image Occlusion representation

Anki 23.10+ supports Image Occlusion natively. Its editor supports rectangles, ellipses and polygons; a note can use “Hide All, Guess One” or “Hide One, Guess One”; grouping multiple shapes makes one card; and editing supports moving, resizing, deleting, grouping and ungrouping. ([Anki Image Occlusion manual](https://docs.ankiweb.net/editing.html#image-occlusion))

The built-in note is a special cloze note with five semantic fields:

1. Occlusions
2. Image
3. Header
4. Back Extra
5. Comments

Anki tags these fields semantically and falls back to positions 0–3 for older compatible note types. The Image field is an HTML `<img src="filename">`; image bytes live in package media. ([native IO notetype source](https://github.com/ankitects/anki/blob/main/rslib/src/image_occlusion/notetype.rs), [native IO field loading](https://github.com/ankitects/anki/blob/main/rslib/src/image_occlusion/imagedata.rs), [field enum](https://github.com/ankitects/anki/blob/main/proto/anki/notetypes.proto))

Editable masks are not baked into the image. They are cloze strings in the Occlusions field, for example:

```text
{{c1::image-occlusion:rect:top=.1:left=.23:width=.4:height=.5}}<br>
{{c1::image-occlusion:rect:top=.7:left=.12:width=.2:height=.1}}<br>
{{c2::image-occlusion:rect:top=.3:left=.5:width=.2:height=.15}}<br>
```

Anki serializes rectangle/ellipse/polygon/text shapes this way. Coordinates are normalized against the image/canvas size; grouped shapes are serialized as multiple clozes with the same ordinal; text annotations use ordinal 0; and `oi=1` records the mode that occludes inactive masks. ([shape serialization](https://github.com/ankitects/anki/blob/main/ts/routes/image-occlusion/shapes/to-cloze.ts), [cloze parsing](https://github.com/ankitects/anki/blob/main/rslib/src/cloze.rs), [shape-property parser](https://github.com/ankitects/anki/blob/main/rslib/src/image_occlusion/imageocclusion.rs))

This maps cleanly to the requested Altitutor behavior:

| Anki | Altitutor |
| --- | --- |
| One native IO note | One image-cloze flashcard |
| Media filename in Image field | Private `flashcard-images` storage object |
| `rect` geometry normalized to canvas | Normalized `{x, y, width, height}` box |
| Cloze ordinal | Positive cloze number |
| Several shapes with the same ordinal | Several boxes on the same review card |
| Header | Optional prompt/title content |
| Back Extra | Existing `extra` rich text after sanitization |
| `oi=1` | Image-cloze reveal mode, if Altitutor chooses to support both modes |

For a rectangle-only first release, reject the entire source note if it contains an active ellipse, polygon, or otherwise unsupported mask. Silently dropping one shape can change what a grouped card asks. Ordinal-0 text annotations may be reported and ignored if Altitutor intentionally does not support image annotations.

The native representation is therefore **highly feasible** to import with editable boxes. It is also safer to translate into an Altitutor-owned JSON shape model than to preserve Anki's cloze string as the runtime model: the source grammar becomes an import adapter, while authoring/review code receives a validated, versioned domain object.

## Legacy Image Occlusion Enhanced representation

Image Occlusion Enhanced (IOE) is an add-on format, not the native Anki representation. Its default note type has eleven fields: `ID (hidden)`, Header, Image, Footer, Remarks, Sources, Extra 1, Extra 2, Question Mask, Answer Mask, and Original Mask. The add-on permits configured field renaming, so names alone are not a universal detector. ([IOE customization documentation](https://github.com/glutanimate/image-occlusion-enhanced/wiki/Customization), [IOE field configuration](https://github.com/glutanimate/image-occlusion-enhanced/blob/master/src/image_occlusion_enhanced/config.py))

IOE creates a separate Anki note for each generated mask/card. Sibling notes are correlated by the hidden ID. Each note references the source image plus generated question-mask and answer-mask SVG media, while the Original Mask field points at a shared editable SVG. The add-on assigns each top-level mask node an ID, emits `-O.svg`, `-Q.svg`, and `-A.svg` media, and uses the original SVG to edit all sibling masks. ([IOE note generator](https://github.com/glutanimate/image-occlusion-enhanced/blob/master/src/image_occlusion_enhanced/ngen.py), [IOE card template](https://github.com/glutanimate/image-occlusion-enhanced/blob/master/src/image_occlusion_enhanced/template.py))

That makes IOE import possible, but not safely universal:

- A valid Original Mask SVG contains the best editable source. Siblings can be coalesced by hidden ID/source image, and each top-level mask node can become one Altitutor cloze number.
- The add-on supports rectangles, ellipses, paths, lines, text, arbitrary shape-library elements, nested groups and SVG transforms. A rectangle-only importer can losslessly accept only simple axis-aligned `<rect>` nodes (and groups containing only transform-free rectangles after rigorously applying inherited transforms). ([IOE advanced-use documentation](https://github.com/glutanimate/image-occlusion-enhanced/wiki/Advanced-Use), [IOE mask-node handling](https://github.com/glutanimate/image-occlusion-enhanced/blob/master/src/image_occlusion_enhanced/ngen.py))
- If Original Mask is absent, the generated Q/A SVG overlays preserve appearance but are a poor general source for reconstructing semantic groups and editable geometry; these notes should be rejected rather than converted into misleading boxes. IOE itself treats a missing image or original mask as uneditable. ([IOE editor loading](https://github.com/glutanimate/image-occlusion-enhanced/blob/master/src/image_occlusion_enhanced/add.py))
- SVG is active content: SVG supports `<script>`. Imported mask SVG must be parsed as untrusted XML with external entities/network access disabled, never inserted into the DOM or stored/served verbatim, and reduced to allowed numeric geometry. ([SVG script element](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script))

Recommendation: do **not** include IOE in the first APKG promise. Add a later, fixture-driven “IOE simple rectangles” adapter that accepts only confidently detected sibling sets with a valid Original Mask SVG and lossless rectangle geometry. Return explicit per-note rejection reasons for everything else.

## Parsing and implementation options

### Recommended first implementation

Implement a shared server-side import domain in `packages/shared` (pure parsing/validation types) plus thin authenticated admin/tutor routes. Do not duplicate format logic between apps as the current route shells do for CSV.

Suggested pipeline:

1. Receive one `.apkg` with a conservative compressed-size limit.
2. Inspect ZIP central-directory entries without extracting paths to disk.
3. Require `collection.anki21` or `collection.anki2` and a valid legacy JSON `media` map; if only `collection.anki21b` is present, return instructions to re-export with “Support older Anki versions.”
4. Enforce entry-count, per-entry uncompressed-size, total-uncompressed-size, and compression-ratio limits before reading payloads.
5. Open SQLite read-only/in-memory. Read the collection model definitions and notes only; scheduling tables are unnecessary.
6. Identify native IO notes by semantic field tags/stock kind when available, with Anki's documented positional fallback and the `image-occlusion:` grammar as corroboration. Do not classify arbitrary cloze notes only by a localized note-type name.
7. Resolve the `<img src>` filename through the media map, verify image bytes by signature and decoded dimensions, and re-encode accepted images to PNG/JPEG/WebP before upload.
8. Parse/validate rectangle clozes into normalized, finite geometry. Require positive ordinals, dimensions greater than zero, and coordinates within an explicitly chosen tolerance; clamp only tiny floating-point drift and reject material out-of-bounds geometry.
9. Sanitize Header/Back Extra through a strict shared HTML policy. Never import card templates, CSS, JavaScript, remote URLs, audio, or Anki scheduling.
10. Return a preview token/result. On confirmation, upload deduplicated source images and insert image-cloze flashcards. If database insertion fails, delete newly uploaded unreferenced objects; if one media item fails, do not partially create its flashcard.

For the legacy package subset, a small ZIP library plus an in-memory SQLite implementation is sufficient. `fflate` provides ZIP decompression, and `sql.js` opens SQLite databases from byte arrays in WebAssembly; both can be wrapped behind Altitutor-owned adapters and tested against generated fixtures. ([fflate source/documentation](https://github.com/101arrowz/fflate), [sql.js source/documentation](https://github.com/sql-js/sql.js)) A native SQLite dependency is another server-only option, but it increases deployment/native-binary friction and does not remove the need for ZIP limits or Anki-format validation.

Avoid adopting a generic community “APKG parser” as the compatibility contract without proving it against native IO fixtures and all accepted package versions. Anki's current package format includes `collection.anki21b`, zstd and protobuf media metadata, so a parser that only looks for `collection.anki2`/`collection.anki21` and JSON `media` is not a full current-format parser. ([Anki package metadata](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/meta.rs), [Anki media format](https://github.com/ankitects/anki/blob/main/rslib/src/import_export/package/media.rs))

### Later full-current-package support

If re-export instructions prove too burdensome, add current APKG support behind the same adapter contract:

- decode Anki's package `meta` protobuf;
- zstd-decompress `collection.anki21b` and the media list;
- decode the media-list protobuf and per-entry compression flags;
- read schema 18 or intentionally convert it to the small internal note/notetype/media projection; and
- keep unknown package versions fail-closed, as Anki does.

This is feasible but adds format maintenance without improving the actual image-cloze mapping. It should be justified by observed rejected-upload volume.

## Security requirements

An APKG is an untrusted ZIP containing a database, HTML fields, and arbitrary media. OWASP recommends extension allowlists, signature/content validation, generated filenames, authorization, size limits, safe storage, and limits based on decompressed size; it explicitly calls out ZIP bombs, parser exploits and client-side active content. ([OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html))

Required controls:

- Authenticate and authorize the destination topic before doing expensive parsing and again before commit.
- Never trust the browser-provided MIME type, archive filenames, media-map filenames, `<img src>`, HTML, SVG or SQLite contents.
- Do not extract archive paths. Address ZIP members by exact internal entry name, reject duplicates/ambiguous names, traversal, absolute paths, NULs and oversized names, and generate new storage filenames.
- Limit compressed request bytes, entry count, individual and total uncompressed bytes, compression ratio, SQLite bytes, note count, media count, image pixels/dimensions, masks per note, and HTML lengths. Time-box parsing where the runtime permits it.
- Decode and re-encode raster images; do not copy media bytes based only on extension. Keep SVG out of the flashcard image bucket in this feature.
- Sanitize imported rich text before it reaches any `dangerouslySetInnerHTML` sink. Strip scripts, event handlers, styles, iframes/objects, forms, remote media, dangerous URL schemes and Anki template syntax not explicitly translated.
- Parse legacy SVG only in a non-rendering XML parser with DTD/external entities disabled, then retain numeric geometry only.
- Use parameterized read-only SQLite queries. Never execute SQL found in the archive, load SQLite extensions, import triggers/views as application logic, or run Anki card templates.
- Make preview and commit idempotent. Hash source note identity/media so a retry cannot silently duplicate a large import; record accepted/rejected counts and stable reasons without logging card HTML or signed URLs.

## Product scope recommendation

Ship in this order:

### Phase 1 — manual authoring and stable native model

Build Altitutor's image-cloze schema/editor/reviewer first. Store a versioned structured object (image storage path, natural dimensions, rectangle boxes, positive cloze numbers, optional reveal mode) rather than overloading `cloze_text`. This gives manual import immediately and defines the target that every external adapter must satisfy.

### Phase 2 — native Anki IO import, legacy-compatible APKG

Add `.apkg` upload/preview in admin-web and tutor-web. Accept native Image Occlusion rectangle notes only, reuse the private image bucket, import fresh scheduling, and give exact re-export instructions for modern packages. This captures the high-value, lossless path with bounded complexity.

### Phase 3 — evidence-led compatibility

Measure rejected imports. Add modern `collection.anki21b` package decoding if users frequently upload it. Add IOE simple-rectangle support only with real anonymized fixture coverage across both IOE modes, grouped rectangles, configured field names, transforms, missing media, and corrupted sibling sets.

## Acceptance fixture matrix

Before advertising Anki support, keep checked-in generated/synthetic fixtures for:

- legacy-compatible APKG with one native IO rectangle;
- multiple rectangles sharing one ordinal and several ordinals in one note;
- both native IO reveal modes;
- Header and Back Extra with allowed formatting and attempted active HTML;
- duplicate source images across notes;
- missing/renamed media, invalid JSON map and corrupt SQLite;
- ellipse, polygon, text annotation, zero-size and out-of-bounds shapes;
- current `collection.anki21b` package producing the intentional re-export message;
- ZIP traversal, duplicate entries, excessive expansion and excessive image pixels;
- later IOE: simple rectangles, grouped rectangles, transforms, non-rectangle paths, absent Original Mask, renamed fields and incomplete sibling sets.

## Decision summary

| Scope | Feasibility | Recommendation |
| --- | --- | --- |
| Manual Altitutor rectangle authoring | High | Build first |
| Native Anki IO rectangles from legacy-compatible APKG | High | Ship as first Anki importer |
| Native ellipses/polygons/text | Medium | Reject initially; add only if Altitutor supports those shapes |
| Current `collection.anki21b` packages | Medium | Later; first instruct re-export |
| IOE simple rectangles with valid Original Mask | Medium | Later compatibility adapter |
| Arbitrary IOE SVG, missing Original Mask, or visual reconstruction | Low/lossy | Do not promise |
| Anki scheduling/history migration | Technically possible but semantically separate | Out of scope; start fresh in Altitutor |

The important architectural decision is to make APKG an adapter into an Altitutor-owned image-cloze model. Native Anki rectangles then import cleanly, IOE can be added as a conservative compatibility adapter, and neither Anki HTML/templates nor SVG becomes part of the student runtime.
