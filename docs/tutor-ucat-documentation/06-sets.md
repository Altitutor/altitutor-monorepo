# Sets

**What this page is for:** Create and manage ordered UCAT question sets used for practice and mocks.

**Route:** `/ucat/sets`

---

## Page layout

- Table of sets with filters for visibility, section, mock usage, timing, and stem/question counts.
- Header action: **Add Set**.
- Row actions: **Edit**, **Delete** / **Restore**.

`[Screenshot: UCAT Sets table with Add Set]`

---

## Create a set

1. Click **Add Set**.
2. Enter:
   - **Name**, optional description
   - Timed / untimed (time limit)
   - **Visibility**
3. Optional: use **auto stem selection** to pick stems by section, category targets, visibility, and “exclude stems already in sets”.
4. Preview the seed selection if offered, then create.

`[Screenshot: Create Set dialog]`

---

## Edit a set

- **Edit** opens the set editor (dialog or full page `/ucat/sets/[id]`).
- You can:
  - Update name, description, timing, visibility
  - Add / remove question stems from the catalog
  - Reorder stems
  - Save when done

`[Screenshot: Set editor with stem list and reorder]`

---

## Bulk actions

- Select multiple sets to change **visibility** or **delete**.

---

## Tips

- Keep one section per set when possible (Reconciliation flags multi-section sets).
- Match stem count and timing to the section’s expected exam shape.
- Private sets are useful for class-only content before publishing.
