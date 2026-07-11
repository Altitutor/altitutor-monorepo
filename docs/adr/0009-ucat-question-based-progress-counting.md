# Question-based UCAT progress counting

UCAT progress displays "questions completed / total questions" using **question progress points**, not question stems. Each non-deleted, accessible non-syllogism question counts as one point. A syllogism stem counts as two points total (matching raw-score weighting), regardless of its five conclusion statements. Soft-deleted questions are excluded from both the bank total and completed counts. Duplicate attempts on the same question are deduped to the best submitted attempt before counting.

We rejected stem-based totals because multi-question stems (e.g. four Verbal Reasoning questions per stem) made completed counts exceed totals. Question-based counting aligns the numerator and denominator with set scoring and `computeMaxRawScore`.
