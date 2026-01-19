# Twilio Voice Call Routing Setup Instructions

## Overview

This guide walks you through setting up Twilio voice call routing for your phone numbers. Once configured, incoming calls will be routed based on:
1. **Business hours** → Forward to office phone
2. **On-call hours** (outside business hours) → Forward to staff member's mobile
3. **After hours** → Play automated message

## Prerequisites

- Twilio account with at least one phone number
- Supabase project with Edge Functions deployed
- Database migration applied (`20260119213000_call_routing_system.sql`)
- Edge Function deployed (`twilio-voice-inbound`)

## Step 1: Deploy Edge Function

Deploy the `twilio-voice-inbound` Edge Function to Supabase:

```bash
# From project root
supabase functions deploy twilio-voice-inbound
```

**Note**: The function URL will be:
```
https://[your-project-ref].supabase.co/functions/v1/twilio-voice-inbound
```

## Step 2: Configure Twilio Phone Number Webhook

You need to configure your Twilio phone number to send incoming voice calls to your Edge Function.

### Option A: Twilio Console (Recommended for Quick Setup)

1. Go to [Twilio Console → Phone Numbers → Manage → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your phone number
3. Scroll to the **"Voice & Fax"** section
4. Under **"A CALL COMES IN"**:
   - Select **Webhook**
   - **URL**: `https://[your-project-ref].supabase.co/functions/v1/twilio-voice-inbound`
   - **HTTP Method**: `POST`
5. Under **"FALLBACK URL"** (optional but recommended):
   - **URL**: `https://[your-project-ref].supabase.co/functions/v1/twilio-voice-inbound`
   - **HTTP Method**: `POST`
6. Click **Save**

### Option B: Twilio API (Programmatic Setup)

If you prefer to configure via API, use this script:

```typescript
// configure-phone-webhook.ts
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const phoneNumberSid = 'PN...'; // Your Twilio phone number SID
const webhookUrl = 'https://[your-project-ref].supabase.co/functions/v1/twilio-voice-inbound';

const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`;

const form = new URLSearchParams();
form.set('VoiceUrl', webhookUrl);
form.set('VoiceMethod', 'POST');
form.set('VoiceFallbackUrl', webhookUrl);
form.set('VoiceFallbackMethod', 'POST');

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: form.toString(),
});

const result = await response.json();
console.log('Phone number configured:', result);
```

## Step 3: Configure Environment Variables

Ensure these environment variables are set in your Supabase project:

- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token (for signature verification)
- `TWILIO_VERIFY_SIGNATURE` - Set to `true` (default) to enable signature verification
- `TWILIO_PUBLIC_URL_VOICE_INBOUND` - (Optional) Override URL for signature verification if behind proxy

**To set in Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add each secret value
3. Redeploy the function if needed

## Step 4: Set Up Database Configuration

### 4.1 Create Routing Rules

You need to create three routing rules for each phone number:

```sql
-- Replace '+61468064000' with your actual Twilio phone number
-- Replace '+61412345678' with your office phone number

-- 1. BUSINESS_HOURS rule (priority 0 - highest priority)
INSERT INTO call_routing_rules (owned_number_id, rule_type, priority, forward_to_phone)
VALUES (
  (SELECT id FROM owned_numbers WHERE phone_e164 = '+61468064000' LIMIT 1),
  'BUSINESS_HOURS',
  0,
  '+61412345678' -- Your office phone number
);

-- 2. ON_CALL rule (priority 50)
INSERT INTO call_routing_rules (owned_number_id, rule_type, priority)
VALUES (
  (SELECT id FROM owned_numbers WHERE phone_e164 = '+61468064000' LIMIT 1),
  'ON_CALL',
  50
);

-- 3. DEFAULT rule (priority 100 - lowest priority)
INSERT INTO call_routing_rules (owned_number_id, rule_type, priority, message_type, message_text)
VALUES (
  (SELECT id FROM owned_numbers WHERE phone_e164 = '+61468064000' LIMIT 1),
  'DEFAULT',
  100,
  'TTS',
  'Thank you for calling. Our office is currently closed. Please call back during business hours.'
);
```

### 4.2 Set Up Opening Hours

Ensure you have opening hours configured in the `opening_hours` table:

```sql
-- Example: Monday-Friday, 9am-5pm
INSERT INTO opening_hours (day_of_week, start_time, end_time, is_active)
VALUES
  (1, '09:00', '17:00', true), -- Monday
  (2, '09:00', '17:00', true), -- Tuesday
  (3, '09:00', '17:00', true), -- Wednesday
  (4, '09:00', '17:00', true), -- Thursday
  (5, '09:00', '17:00', true), -- Friday
ON CONFLICT (day_of_week) DO UPDATE
SET start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_active = EXCLUDED.is_active;
```

### 4.3 Set Up On-Call Schedules (Optional)

Create on-call schedules for staff members:

```sql
-- Example: Staff member on-call Monday-Friday, 6pm-10pm
-- Replace 'staff-uuid-here' with actual staff member ID

INSERT INTO on_call_schedules (staff_id, day_of_week, start_time, end_time, is_active)
SELECT 
  'staff-uuid-here'::uuid,
  day,
  '18:00',
  '22:00',
  true
FROM generate_series(1, 5) AS day; -- Monday (1) to Friday (5)
```

**Important**: Staff members must have a `phone_number` set in the `staff` table to be eligible for on-call routing.

## Step 5: Test the Setup

### 5.1 Test Business Hours Routing

1. Ensure current time is during business hours (e.g., Monday 10am)
2. Call your Twilio phone number
3. **Expected**: Call should forward to your office phone number

### 5.2 Test On-Call Routing

1. Ensure current time is outside business hours but within on-call hours (e.g., Monday 7pm)
2. Ensure a staff member has an active on-call schedule
3. Call your Twilio phone number
4. **Expected**: Call should forward to staff member's mobile phone

### 5.3 Test Default Message

1. Ensure current time is outside business hours and on-call hours (e.g., Saturday 2pm)
2. Call your Twilio phone number
3. **Expected**: Automated TTS message should play

## Troubleshooting

### Calls Not Routing Correctly

1. **Check Edge Function logs**:
   ```bash
   supabase functions logs twilio-voice-inbound
   ```

2. **Verify routing rules exist**:
   ```sql
   SELECT * FROM call_routing_rules 
   WHERE owned_number_id = (SELECT id FROM owned_numbers WHERE phone_e164 = '+61468064000');
   ```

3. **Check opening hours**:
   ```sql
   SELECT * FROM opening_hours WHERE is_active = true ORDER BY day_of_week;
   ```

4. **Verify on-call schedules**:
   ```sql
   SELECT ocs.*, s.phone_number 
   FROM on_call_schedules ocs
   JOIN staff s ON s.id = ocs.staff_id
   WHERE ocs.is_active = true;
   ```

### Signature Verification Fails

If you see "invalid signature" errors:

1. Verify `TWILIO_AUTH_TOKEN` is set correctly
2. Check `TWILIO_PUBLIC_URL_VOICE_INBOUND` matches your actual function URL
3. Ensure Twilio webhook URL matches exactly (no trailing slashes)

### Timezone Issues

- All time comparisons use **Adelaide timezone** (`Australia/Adelaide`)
- Opening hours and on-call schedules are compared against Adelaide time
- Ensure your `opening_hours` and `on_call_schedules` times are in Adelaide timezone

## Advanced Configuration

### Using Audio Files Instead of TTS

To use a prerecorded audio file instead of text-to-speech:

```sql
UPDATE call_routing_rules
SET message_type = 'AUDIO',
    audio_url = 'https://demo.twilio.com/docs/voice.xml' -- Replace with your audio URL
WHERE rule_type = 'DEFAULT'
  AND owned_number_id = (SELECT id FROM owned_numbers WHERE phone_e164 = '+61468064000');
```

**Audio URL Requirements:**
- Must be publicly accessible (HTTPS)
- Supported formats: MP3, WAV, or TwiML `<Play>` compatible URLs
- Can be hosted on Twilio, your own server, or CDN

### Multiple On-Call Staff

If multiple staff are on-call at the same time, the system will use the first match (ordered by `created_at`). To prioritize specific staff:

1. Create on-call schedules in priority order (earlier `created_at` = higher priority)
2. Or delete/recreate schedules to reorder them

### Temporary On-Call Schedules

Currently, on-call schedules are recurring weekly. For temporary schedules:

1. Create the schedule with `is_active = true`
2. Set `is_active = false` when the schedule expires:
   ```sql
   UPDATE on_call_schedules 
   SET is_active = false 
   WHERE id = 'schedule-id-here';
   ```

## Security Notes

- **Signature Verification**: Always enabled by default (`TWILIO_VERIFY_SIGNATURE=true`)
- **HTTPS Required**: Twilio requires HTTPS for webhook URLs (Supabase Edge Functions automatically use HTTPS)
- **RLS Policies**: Only AdminStaff can manage routing rules and on-call schedules

## Next Steps

- **Admin UI**: Build admin interface to manage routing rules (future enhancement)
- **Call Logging**: Add call logs table to track call history (future enhancement)
- **Call Recording**: Enable call recording for compliance (future enhancement)
- **Voicemail**: Add voicemail functionality (future enhancement)

## Support

For issues or questions:
- Check Edge Function logs: `supabase functions logs twilio-voice-inbound`
- Review database queries in Supabase dashboard
- Verify Twilio webhook configuration in Twilio Console
