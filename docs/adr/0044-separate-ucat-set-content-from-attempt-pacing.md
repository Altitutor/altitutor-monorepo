# Separate UCAT set content from attempt pacing

UCAT question sets are reusable content forms with a default timing intent, while a Study plan may prescribe a different pace for one student's attempt. The server validates that prescription against the student's task, resolves and snapshots the effective attempt timing, and never applies it to a mock component; this avoids duplicating or stranding questions across pace-specific sets while keeping comparisons honest by treating set-and-effective-pace as the timing-sensitive benchmark condition. Set selection is independent of authored default pace, direct launches retain the set default, and exam-readiness calibration remains distinguishable through the captured effective pace.

This supersedes ADR-0035 only where that decision treated the authored set timing intent as the sole source of standalone attempt timing. Its set structure, mock timing, placement, and catalog-identity decisions remain in force.
