# UCAT score-estimation model

`@altitutor/ucat-marking` is the sole authority for converting raw marks into
estimated UCAT section scores. Callers should persist the returned model version
and must not implement their own conversion.

Projections deliberately reconvert their stored raw evidence through the active
profile. This prevents historical attempts created by an older model from keeping
the retired conversion alive in forward-looking estimates; attempt records still
retain their original score and model version for audit and display.

## Active profile

`ucat-anz-2026-provisional-v1` uses a section-specific, monotonic empirical
curve. It replaces the former `300 + correctRatio * 600` fallback.

The curve is derived from Tables 40–42 of the official
[2025 UCAT technical report](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf):

- Average the five forms' raw mean and standard deviation for each section.
- Average the corresponding scaled mean, standard deviation and standard error.
- Place anchors at the mean and at one and two standard deviations either side.
- Express raw anchors as a proportion of the operational maximum, interpolate
  between adjacent anchors, and fix the reporting endpoints at 300 and 900.
- Round estimates and uncertainty to the nearest 10, as UCAT scores are reported.

This preserves the real 2025 section shapes and centres much more closely than a
single linear percentage conversion. The official cognitive score is produced
using item response theory and form equating, while SJ uses classical test
theory; Altitutor cannot reproduce those steps without UCAT item parameters and
form assignments. See the report's item-analysis description and the official
[UCAT ANZ scoring guide](https://www.ucat.edu.au/about-ucat-anz/scoring/).

The 2026 profile is provisional because UCAT ANZ 2026 statistics are not due
until the testing window finishes. The official
[test-statistics page](https://www.ucat.edu.au/results/test-statistics/) says
preliminary statistics will be published in late August. A new version should be
created after those statistics are available; historical attempts must retain
their original `scoring_model_version`.

## Evidence rules

- A scaled estimate is returned only for questions from one recognised section.
- Mixed-section or unrecognised sets retain raw marks and a null scaled score.
- Short samples retain a point estimate but expose a wider approximate standard
  error, scaled by the square root of full-attempt marks divided by sample marks.
- Cognitive mock totals are emitted only when every cognitive set has a scaled
  estimate. SJ remains a separate score.

These values are estimates for learner feedback, not claims of official UCAT
results. Item-level calibration can later replace the empirical curve behind the
same package API without changing its callers.
