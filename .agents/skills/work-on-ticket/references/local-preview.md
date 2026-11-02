# Local worktree and human preview

## Acquire and start

Inspect the current repository and worktrees; preserve existing changes and
claims. Fetch `origin/develop`. Read `treehouse get --help` for the installed
version. Reuse the repository's existing durable pool. If access or isolation
requires another pool, choose a permitted durable location and record its root
and reason in Linear. Keep source checkouts outside OS temporary directories;
resume an existing checkout in place rather than moving it or replacing its
lease. Use a durable noninteractive lease with this chat's identity:

```sh
treehouse get --lease --json --base develop -b codex/dev-123-short-topic --lease-holder "<chat-id>:DEV-123"
```

For a coherent group, include each ID in the branch, for example
`codex/dev-123-dev-124-short-topic`. Record the pool root, checkout path, branch,
lease ID and holder in the Linear workpad. Verify its top level, checked-out
branch and base SHA against freshly fetched `origin/develop` before
editing. Run all further tools with that working directory: a `cd` in one shell
call does not move later tool calls. If Treehouse is unavailable, create an
ordinary local Git worktree on that base and record its lifecycle instead.

As resources are created, extend that workpad with their ownership references:
runtime/control/log paths, tracked process sessions, agent-owned browser
sessions/profiles, and temporary artifact directories. Use the existing runtime
manifests as proof; keep credentials out of the workpad. Group ad-hoc artifacts
in one task-owned directory and record test-generated directories separately.

Read `docs/agents/worktree-development.md` **in the new checkout**, check that
`dev:isolated` exists in its `package.json`, and follow that guide. If absent,
report the prerequisite (introduced by DEV-220 / PR #214); acquire the verified
implementation through an authorized dependency merge or explicit base choice
before continuing. A normal fixed-port/shared database server is not a substitute.

Infer affected apps from the tickets/code; include linked portals needed for the
flow. Start the supervisor in a supported tracked terminal/background facility:

```sh
pnpm dev:isolated --apps admin-web,ucat-web
pnpm dev:isolated status
```

Use the selected apps' real names. The guide defines supported web/native
selections, bootstrapping, generated environment, migrations/seeds and cleanup;
consult it rather than copying `.env` files or constructing a second stack.
Check readiness, allocated app/API URLs and ownership. Test the actual page and
its local DB operation before claiming the environment is ready. When database
source changes, follow the guide's snapshot restart procedure.

## Prepare each human checkpoint

1. Pin the preview's code version (commit SHA, plus any uncommitted prototype
   identity) and the exact question. For visual choices, present the alternatives
   through Lavish or the prototype route before asking for a preference.
2. Populate the minimum fixture state for the ticket in **this owned local DB**.
   Follow the environment guide's verified execution path; inspect the target
   before writes. Set up the required account, role and records. Keep secrets out
   of logs, URLs, screenshots and Linear. Give credentials privately in chat only
   when the user actually needs them; prefer opening an authenticated page.
3. Read the installed `chrome-devtools-axi` skill and current CLI help, then open
   the allocated app's exact route and exercise the proposed test. Inspect the
   rendered result, console/network failures and role-specific behavior. Static
   Lavish visuals complement a working functional preview when behavior matters.
4. When available, open that URL in the Codex built-in browser with
   `open_in_codex`. An opened tab is not proof of a tested flow. If that browser
   cannot be controlled, provide the same clickable deep link and test it with
   `chrome-devtools-axi`. Never send the user a generic homepage to find the work.
5. Ask concisely: **link → prepared role/state → actions or choice → expected
   result → exact answer needed**. Publish sanitized evidence, code version and
   the question in Linear. State that localhost needs this computer and that a
   tracked process is only available for its verified lifetime. For a remote
   reviewer, use an already approved private preview path if available; otherwise
   report the access blocker rather than claiming localhost is remotely usable.

Keep the server/DB running while the user is reviewing when the harness supports
it. Verify the supervisor again on resume and recreate the fixture/preview if it
expired. Awaiting Input retains the checkout, lease and review evidence. After
interruption, reconcile the recorded resources and use the environment guide's
owned recovery procedure. On completion, follow [Cleanup](delivery.md#cleanup).
