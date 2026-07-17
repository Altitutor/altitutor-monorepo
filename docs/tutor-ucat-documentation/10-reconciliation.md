# Reconciliation

**What this page is for:** Find and fix inconsistencies in UCAT questions, sets, and mocks.

**Route:** `/ucat/reconciliation` (opens Questions by default)

---

## Page layout

Three tabs with issue counts:

- **Questions**
- **Sets**
- **Mocks**

Each tab lists problem tables. Empty state means that area is consistent.

`[Screenshot: Reconciliation page with Questions / Sets / Mocks tabs]`

---

## Questions tab

Typical issue groups:

| Issue | What to do |
|-------|------------|
| AI-generated questions awaiting approval | **Begin approvals** or row **Review** |
| Uncategorised stems | **Begin reconciling** → assign categories |
| Missing explanations | **Begin reconciling** → Review table → optionally **Bulk generate explanations**, then edit/save |
| Untagged questions | **Begin reconciling** → add tags |
| Private stems not in a set | Add to a set, or change visibility if they should be practice-pool |
| Potential duplicates | **Begin reconciling** / **Compare** → review side-by-side and delete one stem |

`[Screenshot: Questions reconciliation tables with Begin approvals / Begin reconciling]`

Near-duplicate detection compares stem + question + answer-option text within the same section (token and phrase overlap ≥90%). Short stems are skipped to reduce false positives.

---

## Sets tab

Flags such as:

- Incorrect number of questions
- Incorrect timing
- More than one section

Use **Edit** to open the set editor and fix (warning pills highlight the issue).

---

## Mocks tab

- Mocks with incorrect / incomplete sets → open the mock editor and repair the set list.

---

## Tips

- Work top-down: clear pending AI approvals first, then taxonomy gaps, then set/mock structure.
- Re-check the tab count after fixes — it should drop toward zero.
- Don’t bulk-publish until Reconciliation is clean for that section.
