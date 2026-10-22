# DEV-8 throwaway interview prototype

Question: how should a tutor divide attention between watching a student, writing feedback, and coordinating six concurrent stations?

Run from the repository root:

```sh
pnpm dev:isolated --apps tutor-web
```

Open the printed tutor URL, sign in with the disposable seed tutor account from `supabase/seed/test/01z_auth_users.sql`, and use **Interviews · prototype** in the sidebar. Direct path: `/interviews/prototype?variant=A` (also `B` or `C`).

- A: student video above all questions; station status on the right.
- B: all questions take priority; compact video and station status on the right.
- C: station status across the top; video beside one question and rubric at a time.

The floating arrows and keyboard left/right change layout without clearing drafts. Arrow keys inside inputs are preserved. The student toggle is an illustrative preview in the tutor shell, not a student-web implementation. Phase, recording, connection, and completion controls are simulations. Timers are static examples. All state is in memory and clears on refresh. No video provider, recording, autosave, or realtime backend is connected.

The prototype route, navigation entry, and switcher are development-only. Do not merge this prototype into production. Preserve it on `codex/dev-8-interview-prototype`; the current verdict and next questions live in [DEV-8](https://linear.app/altitutor/issue/DEV-8/med-interview-app). Layout selection is still pending. Authoring, round setup, dedicated student screens, and results will be explored after the live-screen decisions.
