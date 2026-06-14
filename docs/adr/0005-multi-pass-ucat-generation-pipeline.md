# Multi-pass UCAT generation pipeline

UCAT AI generation uses a bounded multi-pass pipeline instead of one model call that writes and self-checks. A planner creates diversity and target assignments, a writer generates candidates, deterministic validators check schema and format rules, a separate solver/critic checks answer validity and UCAT fit, and one rewrite attempt may repair salvageable candidates before final gating. This costs more than a single call but better matches the goal of producing tutor-review drafts that need minimal edits.
