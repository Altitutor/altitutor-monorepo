# Isolated worktree development

Run from the worktree whose code you want to serve. Treehouse is optional; the
same command works in a normal Git worktree or checkout.

```sh
pnpm dev:isolated --apps admin-web,ucat-web
```

The default app is `ucat-web`. `--apps all` selects all five web apps.
`--apps student-app` or `--apps ucat-app` also starts the matching web backend.
Docker must be running. The command installs locked dependencies when absent,
builds workspace packages, renders local email templates, and prepares a fresh
snapshot of this checkout's Supabase migrations and configured seeds. It starts
that stack and applies the additional UCAT fixtures before launching the apps.
Local fixture accounts are defined in `supabase/seed/test/01z_auth_users.sql`.

Each session gets a random project identity, separate Docker resources, API/DB/
service ports and an unused port for each selected app. App processes receive
only this stack's connection settings. Copied `.env` settings are blanked before
local URLs and keys are injected; deployment credentials are not copied. Links
between selected apps use their allocated origins. Browser auth cookies are
named per session and app, so simultaneous worktrees on localhost keep separate
sign-ins. Features requiring external providers need a separate explicit setup. Local API and app
URLs are printed after all selected apps are listening. Only one development
session may run in a given checkout; other checkouts and database test stacks
run concurrently.

Keep this command in a terminal or the harness's tracked background-process
facility while editing. Do not rely on an untracked daemon surviving an agent
turn. From another terminal in the same worktree:

```sh
pnpm dev:isolated status
pnpm dev:isolated exec -- node -e 'console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)'
pnpm dev:isolated stop
```

`status` returns JSON with readiness, app/API URLs and local log paths, without
credentials. `exec -- <command>` passes the same verified local database settings
to a foreground command. Treat its environment as secret. Database mutations
inside it must target that owned local database explicitly; the normal
`pnpm checkall` and `pnpm db:*` commands provision their own independent test
stacks. For application tests, use the URLs returned by `status`; fixed-port
test runners do not automatically discover this session.

Ctrl+C, SIGTERM, `stop`, and app failures stop the selected app process groups
and join active `exec` consumers before deleting only this stack with
`--no-backup`. Execution leases are shared within one runtime; they do not
serialize independent worktrees. Session data is disposable.
Startup failures retain logs. Killing the supervisor with SIGKILL retains the
ownership manifest; `status` reports `interrupted`, and `stop` recovers only when
recorded process identities and container receipts still match. Unproven or
replaced resources are retained for inspection instead of guessing ownership.
Existing shared stacks and remote databases are never selected for cleanup.

Migrations and seeds are a startup snapshot. After editing database source, stop
and start again to apply it. Normal application hot reload continues to work.
Expo runs in localhost mode for local simulator/emulator development; this does
not set up physical-device networking, Tailscale, or a portable review URL.

Treehouse acquisition remains explicit:

```sh
treehouse get --base develop -b codex/my-task
pnpm dev:isolated --apps ucat-web
# Stop the development command before exiting the Treehouse subshell.
```

No Treehouse hooks are required. The startup command can also be invoked directly
as `python3 scripts/worktree_dev.py` if dependencies are not installed yet.
