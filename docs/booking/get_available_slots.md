## Booking availability: `get_available_slots`

This document explains how the core booking-availability function `public.get_available_slots` works and how it’s used for **trial sessions**, **subsidy interviews**, and **drafting sessions**, plus recommendations for refactoring if we need to evolve the logic further.

---

## Purpose and high‑level behavior

`public.get_available_slots` is the single source of truth for **when we can book 1:1–style sessions** (currently:

- `DRAFTING`
- `TRIAL_SESSION`
- `SUBSIDY_INTERVIEW`

It returns **time slots** in which:

- The business is open (based on **opening hours**)
- At least one **eligible staff member** is available (based on **recurring availability** and/or **admin shifts**, subject capabilities, blockouts, existing sessions, and reservations)
- The slot respects **date restrictions** (e.g. no past dates, minimum advance days), unless bypassed for admins

The same function is used by both **admin-web** and **student-web** so availability rules stay consistent across surfaces.

---

## Inputs and outputs

### Parameters

`get_available_slots` is defined as:

```sql
public.get_available_slots(
  p_start_date DATE,
  p_end_date DATE,
  p_session_type public.session_type,
  p_subject_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_bypass_date_restrictions BOOLEAN DEFAULT NULL
)
```

- **`p_start_date`, `p_end_date`**
  - Date range (inclusive) to search for availability.
  - Interpreted in **Adelaide time**.

- **`p_session_type`**
  - The type of session we are booking.
  - Currently relevant values: `DRAFTING`, `TRIAL_SESSION`, `SUBSIDY_INTERVIEW`.

- **`p_subject_id`** (optional)
  - Used primarily for **drafting sessions**, where we require staff to be able to teach the subject.

- **`p_duration_minutes`** (optional)
  - Length of each generated slot.
  - Slots are generated at intervals equal to this duration.

- **`p_bypass_date_restrictions`** (optional)
  - If `NULL` (normal case), the function auto-detects if the caller is an active admin (`is_adminstaff_active()`).
    - Admins: restrictions are bypassed.
    - Non-admins: restrictions are enforced.
  - If explicitly `TRUE`/`FALSE`, that value is honored.

### Return shape

The function returns a table:

```sql
RETURNS TABLE (
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  available_staff_ids UUID[],
  is_available BOOLEAN
)
```

Each row represents a **candidate slot** that:

- Starts at `start_at` and ends at `end_at`
- Has at least one available staff member in `available_staff_ids`
- Is currently always returned with `is_available = TRUE` (non-available slots are filtered out)

---

## How slots are generated

### 1. Cleanup and booking settings

At the start of each call:

- Expired `slot_reservations` are **deleted** so that stale holds do not block availability.
- Booking settings are loaded:
  - `booking_buffer_minutes` → `v_booking_buffer`
  - `min_advance_booking_days` → `v_min_advance_days`

These values are used later for buffer checks and minimum-advance date checks.

### 2. Date restrictions & admin bypass

- If `p_bypass_date_restrictions` is `NULL`, we compute:
  - `v_bypass_restrictions := is_adminstaff_active()`
  - Admins can therefore implicitly bypass date restrictions.
- If `v_bypass_restrictions` is **false** (normal student / public use):
  - Compute `v_min_booking_date = today_in_adelaide + min_advance_booking_days`
  - If `p_start_date` is earlier than `v_min_booking_date`, it is **bumped forward** to `v_min_booking_date`.
- If `v_bypass_restrictions` is **true**:
  - We allow **any date**, including past dates (useful for admin backdating or manual adjustments).

### 3. Opening hours → when slots can exist

For each date in `[p_start_date, p_end_date]`:

1. Compute day-of-week: `v_day_of_week` (0 = Sunday, 6 = Saturday).
2. Fetch all **active opening hours ranges** for that day:
   - From `opening_hours`
   - Filter `day_of_week = v_day_of_week AND is_active = true`
   - Ordered by `start_time` ascending

For each opening-hours range:

- Let `v_opening_start` / `v_opening_end` be the time range for that day.
- Starting from `v_opening_start`, we step forward in increments of `p_duration_minutes`:
  - Compute `v_slot_start` and `v_slot_end` in Adelaide time.
  - Stop generating when `v_slot_end` would extend beyond `v_opening_end`.

**Important:**  
If there are multiple opening-hours ranges in a day (e.g. 9–12 and 13–16), we:

- Generate slots inside **each range separately**
- The gap between non-contiguous ranges automatically becomes a **break** with no slots.

### 4. Filtering by time and date rules

For each candidate slot inside an opening-hours range:

- If **not bypassing** date restrictions:
  - Skip if `v_slot_start` is in the **past** relative to now in Adelaide.
  - Skip if `v_slot_start::DATE < v_min_booking_date` (respects minimum advance days).

If a slot fails either of these checks, we **skip to the next slot** in the same range.

---

## How staff availability is computed

For each candidate slot `(v_slot_start, v_slot_end)`, we compute **which staff are available** via a single subquery.

### 1. Staff base filter

We start with:

- `staff.status = 'ACTIVE'`

### 2. Day-of-week availability **or** admin shift override

A staff member is considered available on that date/time if:

- **Option 1 – ADMIN_SHIFT override**
  - They have a `sessions` record of type `ADMIN_SHIFT`
  - Linked via `sessions_staff`
  - With a time range that overlaps the slot (`tstzrange(admin_sess.start_at, admin_sess.end_at) && tstzrange(v_slot_start, v_slot_end)`)

  This means admin shifts **override normal day-of-week availability**: if someone is on an admin shift at that time, they count as available for that time even if their recurring schedule would not normally allow it.

- **Option 2 – Recurring day-of-week availability**
  - For weekdays (Mon–Fri), use `availability_monday` … `availability_friday`
  - For weekends, we split into AM/PM:
    - Saturday: `availability_saturday_am` / `availability_saturday_pm`
    - Sunday: `availability_sunday_am` / `availability_sunday_pm`
  - AM vs PM is determined by the hour of `v_slot_start_time` (< 12 = AM, ≥ 12 = PM).

Either condition is sufficient:

- `(has overlapping ADMIN_SHIFT) OR (recurring day-of-week availability is true for this slot)`

### 3. Session-type–specific capability flags

We then restrict staff by what they’re **allowed** to run:

- **Drafting sessions (`DRAFTING`)**
  - Require `staff.drafting_availability = true`.
  - If `p_subject_id` is provided:
    - Require a matching row in `staff_subjects` linking staff to that subject.

- **Trial sessions (`TRIAL_SESSION`)**
  - Require `staff.trial_session_availability = true`.

- **Subsidy interviews (`SUBSIDY_INTERVIEW`)**
  - Require `staff.subsidy_interview_availability = true`.

For other session types (like `CLASS`, `EXAM_COURSE`, `STAFF_INTERVIEW`), there are no specific capability flags enforced inside `get_available_slots`; those are not part of the trial/drafting/subsidy flows but the function is written to support them.

### 4. Blockouts override everything

We exclude staff if there is any matching `booking_staff_unavailability` record:

- Overlapping `tstzrange(bu.start_at, bu.end_at)` with `tstzrange(v_slot_start, v_slot_end)`.

Blockouts **override admin shifts** and recurring availability — if a staff member has a blockout during the slot, they are simply not available for that slot.

### 5. Existing sessions (non-ADMIN_SHIFT) block availability

We exclude staff who already have a **non-ADMIN_SHIFT** session overlapping the slot:

- Join `sessions` + `sessions_staff`
- Filter `sess.status != 'CANCELLED'` and `sess.type != 'ADMIN_SHIFT'`
- Overlap their `tstzrange(sess.start_at, sess.end_at)` with the slot’s range.

**Note:** ADMIN_SHIFT sessions themselves **do not block** availability in this check; that’s intentional so that being on an admin shift does not prevent using that staff member elsewhere in the block (subject to business rules enforced at booking time).

### 6. Reservations

We exclude staff who have an **active slot reservation** overlapping the candidate slot:

- `slot_reservations` with `expires_at > NOW()` and an overlapping time range.

This prevents double-booking when a slot has been reserved but not yet turned into a concrete session.

### 7. Buffer time (for non-ADMIN_SHIFT sessions)

If `v_booking_buffer > 0`, we enforce a **buffer** before and after the slot:

- Exclude staff who have any **non-ADMIN_SHIFT** session:
  - Ending within `buffer` minutes **before** the slot start.
  - Starting within `buffer` minutes **after** the slot end.

ADMIN_SHIFT sessions are **ignored** for buffer checks so that they don’t create artificial gaps around themselves.

### 8. Emitting the slot

After all filters:

- We collect all matching staff IDs into `v_available_staff`.
- If `v_available_staff` is non-empty:
  - Emit a row:
    - `start_at = v_slot_start`
    - `end_at = v_slot_end`
    - `available_staff_ids = v_available_staff`
    - `is_available = TRUE`

Slots with **no** available staff are silently skipped and not returned.

---

## How this is used in booking flows

### Admin-web and student-web availability APIs

Both apps call the same RPC:

- `apps/admin-web/src/features/bookings/api/availability.ts`
- `apps/student-web/src/features/bookings/api/availability.ts`

Both expose a `getAvailableSlots` function that:

- Passes `start_date`, `end_date`, `session_type`, `subject_id`, `duration_minutes` to the RPC.
- Receives the list of available slots with `available_staff_ids`.

The **booking flows** for:

- **Trial sessions**
- **Subsidy interviews**
- **Drafting sessions**

all derive their candidate times from this same function, then rely on booking-specific SQL functions (e.g., `create_booking_session`, `create_admin_trial_booking`, reschedule functions) to actually create or move sessions with the chosen staff.

---

## Refactoring recommendations

The current pattern — a single, definitive server-side function controlling availability — is sound for this domain, but the implementation is approaching the upper bound of what’s easy to change safely. Below are some targeted refactor ideas that keep the behavior the same while improving maintainability.

### 1. Extract a reusable “staff availability for slot” helper

**Problem:**  
The logic to determine whether a staff member is available for a given time range and session type is a **large, complex inline subquery** inside `get_available_slots`. This makes it hard to:

- Reuse the same rules from other functions (reschedule, manual overrides, reports).
- Unit test the availability rules in isolation.

**Recommendation:**  
Extract a dedicated function, e.g.:

```sql
CREATE OR REPLACE FUNCTION public.get_available_staff_for_slot(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_session_type public.session_type,
  p_subject_id UUID DEFAULT NULL,
  p_booking_buffer_minutes INTEGER DEFAULT 0
)
RETURNS SETOF UUID
```

that encapsulates:

- ADMIN_SHIFT vs recurring day-of-week availability
- Capability flags by session type
- Subject checks for drafting
- Blockouts, other sessions, reservations
- Buffer logic

Then `get_available_slots` can:

- Focus on **time slot generation** based on opening hours & date restrictions.
- Call `get_available_staff_for_slot` per slot and include only those with results.

This makes it easier to:

- Reuse the exact same rules in `create_booking_session`, `reschedule_session`, etc.
- Unit-test availability for specific edge cases by hitting a smaller function.

### 2. Thin “slot generator” + “availability filter” separation

Related to the above, we can conceptually split `get_available_slots` into:

1. **Slot generator** (pure time logic):
   - Input: date range, duration, opening hours, date restrictions, timezone.
   - Output: candidate `(start_at, end_at)` slots with no knowledge of staff.

2. **Availability filter**:
   - Input: slot, session type, subject, buffer.
   - Output: list of staff who can work that slot.

At the SQL level this might still live in one function, but organizing the code into:

- One CTE or inner function that generates candidate slots.
- Another that joins or filters them with staff availability.

…would make the code much easier to follow and change.

### 3. Add focused tests for availability rules

Because this function encodes critical business rules, we should have:

- SQL-level tests (either via Supabase’s testing harness, migration-time assertions, or a small test harness) for:
  - ADMIN_SHIFT overriding day-of-week availability.
  - Blockouts overriding admin shifts.
  - Non-ADMIN_SHIFT sessions blocking slots and buffer behavior.
  - Past-date and minimum-advance enforcement vs admin bypass.

This would give confidence to refactor the function or extract helpers without accidentally changing behavior.

### 4. Document compatibility expectations when changing booking rules

Whenever we change:

- Opening hours behavior
- Staff availability flags or semantics
- Buffer logic
- Session-type-specific rules (e.g., draftings vs trials)

we should update this document and add a short **“Compatibility / behavior changes”** note. That will help future refactors avoid surprises in downstream flows (admin booking tools, student self-serve booking, public trial booking, etc.).

---

## Summary

- `get_available_slots` is the **central authority** for when trial sessions, subsidy interviews, and drafting sessions can be booked.
- It combines:
  - Opening hours (including multiple ranges / lunch breaks)
  - Staff availability (recurring + admin shifts)
  - Capability flags and subject matching
  - Blockouts, existing sessions, reservations, and buffer time
  - Date restrictions with optional admin bypass
- The pattern is solid; the main risk is maintainability as the function grows. Extracting a dedicated staff-availability helper and structuring the function into distinct “slot generation” and “availability filtering” phases would make future changes safer and clearer.

