# Shared UCAT audit runs

UCAT audit runs are shared staff work rather than private to the creating tutor or OAuth client. Any UCAT tutor may list, progress, complete, or cancel any run, and an active `apply_valid_changes` run authorises unattended published writes for its frozen targets regardless of who created it. Creator and OAuth client remain provenance; idempotency stays scoped to creator and client so retries cannot collide across sessions.
