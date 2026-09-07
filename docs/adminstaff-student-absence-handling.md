# Handling Student Absences

Always record what actually happened. If a student attends a session, mark them as attended even if an absence, credit, or reschedule was recorded earlier. Attendance makes that session payable and the billing system will make the required adjustment automatically.

## Choose the appropriate action

| Situation | AdminStaff action |
| --- | --- |
| Notice received before closing time (approximately 7pm) on the previous day | **Reschedule.** If no suitable session is available, try again later. If the student refuses after a genuine rescheduling reattempt, **Credit** the original session. |
| Late notice, but an exceptional reason is accepted at AdminStaff discretion | Handle as on-time notice: **Reschedule**, reattempt if needed, then **Credit** if the student refuses after the reattempt. |
| Notice received after closing time without an accepted exceptional reason | **Reschedule.** If the student refuses, leave the original session payable. If the reschedule was already recorded, use **Undo log absence** to remove it; if the UI prevents this, escalate it rather than making a manual financial adjustment. |
| Extended absence where rescheduling is not reasonably possible | **Credit** the affected session or sessions. |

When rescheduling, find a suitable replacement and tell the student the new time. AdminStaff do not need to ask permission before assigning the replacement.

## What Credit and Reschedule do

- **Credit** removes the charge for the original session. If it was already invoiced, the system creates the required credit note automatically.
- **Reschedule** removes the charge for the original session and assigns a replacement session. The replacement is billed as a normal session at its own price and subsidy.
- Never create a separate Stripe credit note or directly edit a student's credit balance for these actions.

If the screen says billing has been queued for retry, the absence was saved. Do not submit it again or add a manual credit. Only investigate if it later appears in Financial reconciliation.

## If attendance changes the outcome

- If the student attends the original session after it was credited or rescheduled, mark them as attended. The system will restore the original charge.
- If they attend both the original and replacement sessions, both sessions are payable.
- If they attend the original but miss the replacement, both remain payable unless AdminStaff separately approve a credit for the replacement under the normal absence policy.
- If they attend only the replacement, the original remains credited and the replacement is payable.
- If attendance was recorded incorrectly, correct the attendance record promptly. Do not try to correct the outcome in Stripe or through a manual balance adjustment.

## Financial reconciliation

Financial reconciliation shows only adjustments that are overdue, retrying, blocked, or failed. Routine pending work does not require action. Review the underlying absence and attendance records first, and do not create duplicate charges or credits manually.
