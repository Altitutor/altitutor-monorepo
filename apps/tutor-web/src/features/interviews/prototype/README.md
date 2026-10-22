# DEV-8 throwaway interview prototype

Question: how should a tutor divide attention between watching a student, writing feedback, and coordinating six concurrent stations?

Run from the repository root:

```sh
pnpm dev:isolated --apps tutor-web
```

Open the printed tutor URL, sign in with the disposable seed tutor account from `supabase/seed/test/01z_auth_users.sql`, and use **Interviews · prototype** in the sidebar for the bank/builder. Direct live path: `/interviews/prototype?variant=C` (also `A` or `B`). The fullscreen C live direction is accepted.

- A: student video above all questions; station status on the right.
- B: all questions take priority; compact video and station status on the right.
- C: station status across the top; video beside one question and rubric at a time.

The live screen fills the viewport and hides portal navigation. Its collapsible top toolbar includes pause/resume and Exit. Exit and browser Back show a confirmation; reload/close use the browser's native before-unload warning, subject to browser support. This is a demonstration guard, not a tested production navigation boundary.

Open **Prototype controls** to see phase, delivery, recording, connection and completion simulations, plus the floating layout arrows. Left/right changes layouts without clearing drafts; arrow keys inside inputs are preserved. Timers run from a local wall clock: reading/questions count down and auto-advance; other phases count up. Pause freezes the clock. The student preview shows only station numbers, and a timer only during reading. It remains an illustration inside tutor-web, not a student-web implementation.

Nonempty feedback marks a question answered. Rubrics can be edited in place. In-person delivery lets tutors select arriving students during waiting, reading or questions; students claimed elsewhere are disabled, and changing a student after entering feedback/score requires confirmation. These claims are local simulations, not concurrency protection. In-person media is an audio-only placeholder.

All state is in memory and clears on refresh. No video provider, recording, autosave, or realtime backend is connected. No camera/microphone is accessed. No automated tests were added for this throwaway prototype.

Bank/builder route: `/interviews/prototype/authoring?variant=A` with `screen=bank` (default) or `screen=builder`. All variants share in-memory content across screen/layout switches:

- A: category rail + bank table; station rail + focused editor with a bank picker.
- B: bank list + persistent detail preview; station editor beside a searchable bank.
- C: questions grouped as category cards; an overview board of all stations.

Try creating/editing/archiving/restoring a question, adding or renaming categories/tags, searching and filtering, adding/reordering stations and questions, setting decimal maximum points, and opening per-station/all-station printed prompt previews. Bank editing uses plain text in this prototype; production rich-text authoring remains planned. Print previews do not export PDFs. Shared question edits update the prepared interview; archives retain its existing placements; repetition warns without blocking. Every question has one category and zero or more separate tags. Question 1 always provides the reading/printed prompt, including after reorder.

The prototype routes, navigation entry, and switcher are development-only. Do not merge this prototype into production. Preserve it on `codex/dev-8-interview-prototype`; the current verdict and next questions live in [DEV-8](https://linear.app/altitutor/issue/DEV-8/med-interview-app). Bank/builder layout choices are pending. Round setup, dedicated student screens, and results remain to be explored.
