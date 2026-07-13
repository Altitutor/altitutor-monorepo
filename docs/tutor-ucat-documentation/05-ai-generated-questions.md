# AI generated questions

**What this page is for:** Generate question stems with AI, then review and approve them before they join the live question bank.

**Route:** `/ucat/questions?tab=generated`  
Use the **Generated questions** tab.

---

## Page layout

- Same stem table as Questions, filtered to AI drafts.
- Extra filter: **Approval status** — Pending / Approved / Rejected.
- Header actions: **Begin approvals**, **Generate questions**.

`[Screenshot: Generated questions tab with Begin approvals and Generate questions]`

---

## Generate questions

1. Click **Generate questions**.
2. Configure:

**Question settings**

- **Section**
- **Stem category** (or realistic category mix)
- **Number of stems**
- **Difficulty target** — Mixed / Easy / Medium / Hard
- **Time burden target** — Mixed / Low / Medium / High
- **Target tags** (optional)

**AI settings**

- **Model profile**
- **Source examples** — Random approved stems / Manually choose / No source examples
- Optionally include AI-generated stems as sources
- **Image generation** — Auto / Deterministic renderer / AI-generated stem image
- **Run instructions** — one-off notes for this run

3. Wait for generation to finish.
4. **Review** the draft stems in the modal.
5. Click **Import to generated queue**.

Imported stems:

- Appear on the **Generated questions** tab
- Start as **Pending**
- Are **Private** by default
- Source = **AI generation**

`[Screenshot: Generate questions modal — config step]`

`[Screenshot: Generate questions modal — review step]`

---

## Approve generated stems

### From the table

- Filter to **Pending**.
- Open a stem with **Edit** / review page to check content.
- Or use the full-page generated review (`/ucat/questions/generated/[id]`) with:
  - **Reject**
  - **Mark pending**
  - **Approve and publish**
  - **Save changes**

### Begin approvals (queue)

1. Optionally filter the table first (section, category, etc.).
2. Click **Begin approvals**.
3. Work through stems one by one:

| Action | What it does |
|--------|----------------|
| **Approve** / **Next question** | Accept and move on |
| **Reject** | Reject this stem |
| **Skip** | Leave as-is and move on |
| **Previous question** | Go back |

`[Screenshot: Approval queue with Reject / Skip / Approve controls]`

---

## Editing while reviewing

- Fix stem text, questions, answers, tags, or category before approving.
- Use **AI Tools** in the stem editor if you want interactive help on the current draft.
- Save before approving if you’ve made edits.

---

## Tips

- Generate in smaller batches so review stays manageable.
- Use strong **source examples** when you want a consistent style.
- Don’t approve until explanations, answers, and images look student-ready.
- After approval, stems behave like normal bank items — manage them on the **Questions** tab.
- Pending AI items also appear under **Reconciliation → Questions** if you prefer to clear them from there.
