# Correct interview attribution and withdraw affected releases

Matthew approved DEV-468’s review recommendations on 20 November 2026. Correct completed mock attribution by retaining each complete encounter’s identity, including scores, feedback, question timing and recording links: replace an outside-roster Student across the round, or let the station tutor swap two Students’ encounters at that station. Increment affected assessment versions so a stale tab cannot overwrite the correction.

Unlike an ordinary draft score correction, attribution correction immediately withdraws affected Student result and playback access until an explicit corrected release. Historical releases remain immutable staff audit evidence, but withdrawn releases cannot supply new performance-review publication evidence. Published performance reviews keep their frozen evidence and require their authors to review and republish separately; the correction UI warns about this consequence.

This accepts a temporary gap in Student results in exchange for preventing continued access to another Student’s performance. Re-release revisions remain monotonic across withdrawal. Unstarted round deletion retains its operational record while removing portal and realtime access.

Tutor marking guidance now always resolves the latest saved rubric, including completed mocks, without revision notices. This refines ADR0057/0058: prompt/question wording and released Student guidance remain fixed; internal save concurrency and rubric audit history remain intact.
