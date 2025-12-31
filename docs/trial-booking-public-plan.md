# Public Trial Session Booking - Implementation Plan

## Overview
Enable trial session booking for anyone, including non-logged-in users. The flow collects student and optional parent details, creates a student record with status 'TRIAL', and books the trial session.

## Flow

### Step 1: Collect Student & Parent Details
**Required Student Fields:**
- First Name
- Last Name
- Curriculum (select: SACE, IB, PRESACE, PRIMARY)
- Year Level
- Phone (use shared PhoneInput component)
- Email

**Optional Parent Fields:**
- First Name
- Last Name
- Phone
- Email
- OR checkbox: "Skip parent details"

### Step 2: Select Time Slot
- Show available trial session slots
- User selects a time slot
- No reservation system for anonymous users (book directly)

### Step 3: Create Booking
1. **Create/Update Student Record:**
   - Check if student exists by `student_email`
   - If exists: Update record (merge data, keep existing `user_id` if present)
   - If not: Create new student record with:
     - `status = 'TRIAL'`
     - `user_id = NULL` (will be linked later via `link_precreated_user()` trigger)
     - All collected student fields
     - Parent fields (if provided)

2. **Create Trial Session:**
   - Use existing `create_booking_session()` function
   - Pass `student_id` (from step 1)
   - Pass `session_type = 'TRIAL_SESSION'`
   - Staff assignment handled automatically by function

## Database Schema

### Students Table Fields Used
- `id` (UUID, generated)
- `first_name` (TEXT, required)
- `last_name` (TEXT, required)
- `student_email` (TEXT, nullable) - student's email
- `student_phone` (TEXT, nullable) - student's phone (renamed from `phone` in migration)
- `curriculum` (TEXT, nullable) - SACE, IB, PRESACE, PRIMARY
- `year_level` (INTEGER, nullable)
- `parent_first_name` (TEXT, nullable)
- `parent_last_name` (TEXT, nullable)
- `email` (TEXT, nullable) - parent's email
- `phone` (TEXT, nullable) - parent's phone
- `status` (TEXT, required) - set to 'TRIAL'
- `user_id` (UUID, nullable) - NULL initially, linked later

**Note**: Based on migration `20250427000000_schema_updates.sql`, the table has:
- `student_email` and `student_phone` for student contact info
- `email` and `phone` for parent contact info
- `parent_first_name` and `parent_last_name` for parent names

## Implementation Plan

### Phase 1: Database Function

#### 1.1 Create Public Trial Booking Function
**File**: `supabase/migrations/[timestamp]_create_public_trial_booking_function.sql`

**Function**: `create_public_trial_booking()`

**Parameters**:
```sql
CREATE OR REPLACE FUNCTION public.create_public_trial_booking(
  -- Student details
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_email TEXT,
  p_student_phone TEXT,
  p_curriculum TEXT, -- SACE, IB, PRESACE, PRIMARY
  p_year_level INTEGER,
  
  -- Parent details (optional)
  p_parent_first_name TEXT DEFAULT NULL,
  p_parent_last_name TEXT DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  
  -- Session details
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS UUID -- Returns session_id
```

**Logic**:
1. **Find or Create Student:**
   ```sql
   -- Check if student exists by email
   SELECT id, user_id INTO v_student_id, v_existing_user_id
   FROM students
   WHERE LOWER(student_email) = LOWER(p_student_email)
   LIMIT 1;
   
   IF v_student_id IS NULL THEN
     -- Create new student
     INSERT INTO students (
       id, first_name, last_name, student_email, student_phone,
       curriculum, year_level,
       parent_first_name, parent_last_name, email, phone,
       status, user_id
     ) VALUES (
       gen_random_uuid(),
       p_student_first_name, p_student_last_name,
       p_student_email, p_student_phone,
       p_curriculum, p_year_level,
       p_parent_first_name, p_parent_last_name,
       p_parent_email, p_parent_phone,
       'TRIAL', NULL
     ) RETURNING id INTO v_student_id;
   ELSE
     -- Update existing student (merge data, preserve user_id)
     UPDATE students
     SET
       first_name = COALESCE(p_student_first_name, first_name),
       last_name = COALESCE(p_student_last_name, last_name),
       student_phone = COALESCE(p_student_phone, student_phone),
       curriculum = COALESCE(p_curriculum, curriculum),
       year_level = COALESCE(p_year_level, year_level),
       parent_first_name = COALESCE(p_parent_first_name, parent_first_name),
       parent_last_name = COALESCE(p_parent_last_name, parent_last_name),
       email = COALESCE(p_parent_email, email),
       phone = COALESCE(p_parent_phone, phone),
       status = 'TRIAL' -- Ensure status is TRIAL
     WHERE id = v_student_id;
   END IF;
   ```

2. **Create Session:**
   ```sql
   -- Use existing create_booking_session function
   v_session_id := create_booking_session(
     p_session_type := 'TRIAL_SESSION',
     p_student_id := v_student_id,
     p_start_at := p_start_at,
     p_end_at := p_end_at,
     p_subject_id := NULL, -- No subject for trial sessions
     p_staff_id := NULL, -- Auto-assign
     p_reservation_id := NULL, -- No reservation for public bookings
     p_created_by := NULL -- No authenticated user
   );
   ```

3. **Return Session ID:**
   ```sql
   RETURN v_session_id;
   ```

**Security**:
- Use `SECURITY DEFINER` to bypass RLS
- Validate email format
- Validate curriculum enum
- Validate year_level range
- Check for duplicate bookings (same student + same time slot)

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION public.create_public_trial_booking TO anon, authenticated;
```

### Phase 2: API Route

#### 2.1 Create Public Trial Booking API Route
**File**: `apps/student-web/src/app/api/bookings/trial/public/route.ts`

**Endpoint**: `POST /api/bookings/trial/public`

**Authentication**: None required

**Request Body**:
```typescript
{
  // Student details (required)
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  student_phone: string;
  curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';
  year_level: number;
  
  // Parent details (optional)
  parent_first_name?: string;
  parent_last_name?: string;
  parent_email?: string;
  parent_phone?: string;
  skip_parent_details?: boolean;
  
  // Session details (required)
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
}
```

**Response**:
```typescript
{
  session_id: string;
  student_id: string;
}
```

**Security Measures**:
1. **Rate Limiting**:
   - Per IP: Max 3 bookings per hour
   - Per email: Max 1 booking per day
   - Use Next.js middleware or Upstash Redis

2. **Input Validation**:
   - Email format validation
   - Name length limits (1-100 chars)
   - Phone format validation
   - Curriculum enum validation
   - Year level range validation (1-12)
   - Date validation (future dates only, within booking window)

3. **Duplicate Prevention**:
   - Check for existing session at same time slot for same student
   - Check for recent bookings from same IP/email

4. **Error Handling**:
   - Return user-friendly error messages
   - Log security events
   - Don't expose internal errors

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Rate limiting (implement with Upstash Redis or database)
async function checkRateLimit(ip: string, email: string): Promise<boolean> {
  // Implementation here
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    const allowed = await checkRateLimit(ip, body.student_email);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Validation
    if (!body.student_first_name || !body.student_last_name || 
        !body.student_email || !body.curriculum || 
        !body.start_at || !body.end_at) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate curriculum
    if (!['SACE', 'IB', 'PRESACE', 'PRIMARY'].includes(body.curriculum)) {
      return NextResponse.json(
        { error: 'Invalid curriculum' },
        { status: 400 }
      );
    }
    
    // Create Supabase client (anon key for public access)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Call database function
    const { data: sessionId, error } = await supabase.rpc('create_public_trial_booking', {
      p_student_first_name: body.student_first_name,
      p_student_last_name: body.student_last_name,
      p_student_email: body.student_email,
      p_student_phone: body.student_phone || null,
      p_curriculum: body.curriculum,
      p_year_level: body.year_level || null,
      p_parent_first_name: body.skip_parent_details ? null : (body.parent_first_name || null),
      p_parent_last_name: body.skip_parent_details ? null : (body.parent_last_name || null),
      p_parent_email: body.skip_parent_details ? null : (body.parent_email || null),
      p_parent_phone: body.skip_parent_details ? null : (body.parent_phone || null),
      p_start_at: body.start_at,
      p_end_at: body.end_at,
    });
    
    if (error) {
      console.error('Booking error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create booking' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      session_id: sessionId,
      student_id: body.student_id, // Return from function if needed
    });
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Phase 3: Frontend Changes

#### 3.1 Move Trial Booking Page Outside Auth Group
**Action**: Move `apps/student-web/src/app/(student)/book-trial/page.tsx` to `apps/student-web/src/app/book-trial/page.tsx`

#### 3.2 Update Middleware
**File**: `apps/student-web/src/middleware.ts`

Add `/book-trial` to public paths:
```typescript
const isPublicPath = 
  pathname === '/' ||
  pathname.startsWith('/login') || 
  pathname.startsWith('/forgot-password') || 
  pathname.startsWith('/reset-password') || 
  pathname.startsWith('/invite/') || 
  pathname.startsWith('/auth/') ||
  pathname.startsWith('/book-trial'); // ADD THIS
```

#### 3.3 Create Contact Form Component
**File**: `apps/student-web/src/features/bookings/components/TrialContactForm.tsx`

**Fields**:
- Student First Name (required)
- Student Last Name (required)
- Student Email (required, validated)
- Student Phone (required, use PhoneInput from `@altitutor/ui`)
- Curriculum (required, select dropdown)
- Year Level (required, number input)
- Parent First Name (optional)
- Parent Last Name (optional)
- Parent Email (optional, validated)
- Parent Phone (optional, use PhoneInput)
- Checkbox: "Skip parent details"

**Validation**:
- Use `react-hook-form` + `zod`
- Real-time email format validation
- Phone format validation
- Curriculum enum validation
- Year level range (1-12)

#### 3.4 Update Trial Booking Page
**File**: `apps/student-web/src/app/book-trial/page.tsx`

**Steps**:
1. **Contact Details** (new step)
   - Show `TrialContactForm` component
   - Collect all student/parent details

2. **Select Time**
   - Show `TimeSlotPicker` component
   - Skip reservations for anonymous users

3. **Confirm Booking**
   - Show booking summary
   - Submit to public API endpoint

**Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingFlow } from '@/features/bookings/components/BookingFlow';
import { TimeSlotPicker } from '@/features/bookings/components/TimeSlotPicker';
import { TrialContactForm } from '@/features/bookings/components/TrialContactForm';
import { Button, useToast } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';

interface ContactFormData {
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  student_phone: string;
  curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';
  year_level: number;
  parent_first_name?: string;
  parent_last_name?: string;
  parent_email?: string;
  parent_phone?: string;
  skip_parent_details: boolean;
}

export default function BookTrialPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [contactData, setContactData] = useState<ContactFormData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactSubmit = (data: ContactFormData) => {
    setContactData(data);
    setCurrentStep(1); // Move to time selection
  };

  const handleSlotSelect = (startAt: string, endAt: string) => {
    setSelectedSlot({ startAt, endAt });
    setCurrentStep(2); // Move to confirmation
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !contactData) {
      toast({
        title: 'Missing Information',
        description: 'Please complete all steps',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bookings/trial/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contactData,
          start_at: selectedSlot.startAt,
          end_at: selectedSlot.endAt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      const { session_id } = await response.json();

      toast({
        title: 'Booking Confirmed',
        description: 'Your trial session has been booked successfully',
      });

      // Redirect to confirmation page or session details
      router.push(`/book-trial/confirmation?sessionId=${session_id}`);
    } catch (error: any) {
      toast({
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    {
      id: 'contact',
      title: 'Student Details',
      component: (
        <TrialContactForm
          onSubmit={handleContactSubmit}
          defaultValues={contactData || undefined}
        />
      ),
    },
    {
      id: 'time',
      title: 'Select Time',
      component: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an available time slot for your trial session
          </p>
          <TimeSlotPicker
            sessionType="TRIAL_SESSION"
            durationMinutes={60}
            onSlotSelect={handleSlotSelect}
            selectedSlot={selectedSlot}
            allowAnonymous={true}
          />
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm Booking',
      component: (
        <div className="space-y-4">
          {/* Booking summary */}
          <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              'Confirm Booking'
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container max-w-4xl py-8">
      <BookingFlow
        title="Book Trial Session"
        description="Schedule a free trial session to experience our tutoring"
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />
    </div>
  );
}
```

#### 3.5 Update TimeSlotPicker Component
**File**: `apps/student-web/src/features/bookings/components/TimeSlotPicker.tsx`

**Changes**:
- Add `allowAnonymous` prop
- Skip reservation creation if `allowAnonymous && !isAuthenticated`
- Show different messaging for anonymous users

### Phase 4: RLS & Security

#### 4.1 Update RLS Policies
**File**: `supabase/migrations/[timestamp]_update_rls_for_public_trial.sql`

**`get_available_slots` function**:
- Already `SECURITY DEFINER` → accessible to anonymous users
- Verify grants: `GRANT EXECUTE ON FUNCTION public.get_available_slots TO anon, authenticated;`

**`students` table**:
- Public trial booking function uses `SECURITY DEFINER` → bypasses RLS
- No changes needed to RLS policies

**`sessions` table**:
- Public trial booking function uses `SECURITY DEFINER` → bypasses RLS
- No changes needed to RLS policies

## Security Considerations

### 1. Rate Limiting
- Per IP: 3 bookings/hour
- Per email: 1 booking/day
- Implement with Upstash Redis or database table

### 2. Input Validation
- Server-side validation (never trust client)
- Email format validation
- Name sanitization
- Phone format validation
- Curriculum enum validation
- Year level range validation

### 3. Abuse Prevention
- Duplicate booking detection
- Email/phone blacklist (if needed)
- Monitor for suspicious patterns

### 4. Data Privacy
- Don't expose internal errors
- Log security events separately
- GDPR compliance (data collection notice)

## Testing Considerations

### Unit Tests
- Public booking API route
- Database function
- Input validation
- Rate limiting logic

### Integration Tests
- End-to-end booking flow (anonymous)
- Student record creation/update
- Duplicate prevention

### E2E Tests
- Complete anonymous booking flow
- Edge cases (duplicate email, etc.)

## Migration Strategy

### Phase 1: Database (Non-Breaking)
1. Create `create_public_trial_booking()` function
2. Add grants for anonymous users
3. Test function directly

### Phase 2: API Routes (New Endpoints)
1. Create public API routes
2. Add rate limiting
3. Test thoroughly

### Phase 3: Frontend (Gradual Rollout)
1. Move page outside auth group
2. Update middleware
3. Add contact form step
4. Update components conditionally

### Phase 4: Monitoring
1. Monitor booking rates
2. Watch for abuse patterns
3. Adjust rate limits as needed

## Files to Create/Modify

### New Files
- `apps/student-web/src/app/book-trial/page.tsx` (moved from `(student)/book-trial/`)
- `apps/student-web/src/app/api/bookings/trial/public/route.ts`
- `apps/student-web/src/features/bookings/components/TrialContactForm.tsx`
- `supabase/migrations/[timestamp]_create_public_trial_booking_function.sql`
- `supabase/migrations/[timestamp]_update_rls_for_public_trial.sql`

### Modified Files
- `apps/student-web/src/middleware.ts` (add `/book-trial` to public paths)
- `apps/student-web/src/features/bookings/components/TimeSlotPicker.tsx` (add anonymous support)
