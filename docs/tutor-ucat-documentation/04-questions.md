# Questions

**What this page is for:** Manage the UCAT question bank — create, edit, import, organise, and delete question stems (not AI batch generation).

**Route:** `/ucat/questions`  
Use the **Questions** tab (not **Generated questions**).

> AI batch generation and approvals are covered in **AI generated questions**.

---

## Page layout

- Table of **question stems** (passages / shared stimulus).
- Expand a stem → its **questions** → each question’s **answer options**.
- Search and filters sit above the table.
- Header actions on this tab: **Bulk Import**, **Add Question Stem**.

`[Screenshot: Questions tab with table, filters, Bulk Import and Add Question Stem]`

---

## Search and filters

- **Search** scopes: Stem text, Question text, Answer options, Tutor source note.
- Common filters:
  - **Section**, **Category**, **Tag**
  - **Visibility** — Public / Private
  - **Type** — Multiple Choice / Syllogism
  - **Source** — Individual add / Bulk import / AI generation
  - **Created by**, **Set** (including “Not in any set”)
- Toggle **Show deleted** to restore soft-deleted stems.
- Use column groups to show/hide stem, question, or answer-option columns.

---

## Add a single stem

1. Click **Add Question Stem**.
2. Choose section, type, visibility, category/tags as needed.
3. Enter stem text, questions, and answers.
4. Save — or use **Open in page** for the full-page editor.

`[Screenshot: Create Question Stem dialog]`

---

## Edit a stem

- Row **Edit** opens the stem dialog.
- **Open in page** goes to `/ucat/questions/[id]` for a larger editor.
- In the full editor:
  - Edit stem, questions, options, images, and properties
  - Use **AI Tools** for interactive help on *this* stem (rewrites, images, adding questions)
  - Click **Save changes**

`[Screenshot: Full-page stem editor with Save changes]`

---

## Bulk import

Use **Bulk Import** when you already have stems/questions in a document.

Typical flow:

1. **Choose section**
2. Paste content (combined document, or stems + questions separately)
3. Complete optional steps (syllogism statements, answers, categories, tags)
4. **Review** parsed stems and fix anything wrong
5. Optionally **Create set** / add to a set
6. Click **Import**

`[Screenshot: Bulk import wizard on the review step]`

Notes:

- Imported stems are marked source **Bulk import**.
- You can add a **tutor source note** for your own tracking.
- This is paste/parse — not AI generation.

---

## Organise stems (sets, category, visibility)

Select one or more rows, then use the selection toolbar:

- **Category** — assign a stem category
- **Visibility** — Public / Private
- **Add to sets** / **Remove from sets**
- **Delete**

Click a set name in the **Sets** column to open the set editor.

Badges you may see:

- **Practice pool** — available in practice
- **Not student-visible** — private / hidden from students
- **Set only · hidden from practice** — only appears via sets

---

## Delete and restore

- **Delete** soft-deletes the stem.
- Turn on **Show deleted**, then **Restore** if needed.

---

## Tips

- Prefer categories + tags so Reconciliation and set building stay accurate.
- Use Private while drafting; switch to Public when ready for students.
- For large pastes, use Bulk Import; for one-offs, use Add Question Stem.
