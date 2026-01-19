# Twilio Voice Call Forwarding Setup Guide

## Overview

This guide explains how to set up Twilio voice call forwarding with flexible routing logic that can be configured through your application. The system will:

1. **Basic Setup**: Forward calls to a specified phone number
2. **Future Enhancement**: Route calls based on:
   - Business hours → office phone
   - On-call hours → admin staff phone
   - Otherwise → voicemail or automated message

## Architecture Recommendations

### Recommended Approach: TwiML Webhook Pattern

**Best Practice**: Use a TwiML webhook endpoint that returns dynamic TwiML based on your application logic. This provides:

- ✅ Maximum flexibility for routing logic
- ✅ Easy to update routing rules without changing Twilio configuration
- ✅ Can query your database for routing decisions
- ✅ Supports complex conditional logic
- ✅ Maintains caller ID (SHAKEN/STIR compliance)

### Architecture Flow

```
Incoming Call → Twilio Phone Number → Your Webhook Endpoint → TwiML Response → Forward/Handle Call
```

1. **Twilio receives call** on your owned number
2. **Twilio sends webhook** to your Supabase Edge Function
3. **Your function determines routing** based on:
   - Current time (business hours)
   - On-call schedules
   - Staff availability
   - Other business rules
4. **Function returns TwiML** with routing instructions:
   - `<Dial>` to forward to phone number
   - `<Say>` + `<Record>` for voicemail
   - `<Say>` for automated message
   - `<Enqueue>` for call queues (future)

## Implementation Steps

### Step 1: Create Voice Webhook Endpoint

Create a new Supabase Edge Function: `twilio-voice-inbound`

**File**: `supabase/functions/twilio-voice-inbound/index.ts`

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  parseFormEncoded,
  verifyTwilioSignature,
} from '../twilio-inbound/shared/security.ts';

/**
 * Generate TwiML XML response
 */
function generateTwiML(instructions: {
  dial?: string; // Phone number to dial
  say?: string; // Message to say
  record?: boolean; // Record voicemail
  voicemailUrl?: string; // URL to send recording
}): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<Response>'];
  
  if (instructions.say) {
    parts.push(`<Say voice="alice">${escapeXml(instructions.say)}</Say>`);
  }
  
  if (instructions.dial) {
    // Use <Dial> to forward call and preserve caller ID
    parts.push(`<Dial callerId="${instructions.dial}">${escapeXml(instructions.dial)}</Dial>`);
  }
  
  if (instructions.record) {
    parts.push(`<Record action="${instructions.voicemailUrl || ''}" maxLength="60" />`);
  }
  
  parts.push('</Response>');
  return parts.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Determine call routing based on business logic
 */
async function determineCallRouting(
  supabase: ReturnType<typeof createClient>,
  toNumber: string
): Promise<{
  dial?: string;
  say?: string;
  record?: boolean;
  voicemailUrl?: string;
}> {
  // TODO: Implement your routing logic here
  // Examples:
  
  // 1. Simple forwarding (for initial setup)
  // return { dial: '+1234567890' };
  
  // 2. Business hours check
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Example: Business hours 9 AM - 5 PM, Monday-Friday
  const isBusinessHours = 
    dayOfWeek >= 1 && dayOfWeek <= 5 && // Mon-Fri
    hour >= 9 && hour < 17; // 9 AM - 5 PM
  
  if (isBusinessHours) {
    // Forward to office phone
    // TODO: Get office phone from database
    return { dial: '+1234567890' }; // Replace with actual office number
  }
  
  // 3. Check for on-call staff
  // TODO: Query database for staff on call during current time
  // const { data: onCallStaff } = await supabase
  //   .from('staff')
  //   .select('phone')
  //   .eq('on_call', true)
  //   .gte('on_call_start', now.toISOString())
  //   .lte('on_call_end', now.toISOString())
  //   .maybeSingle();
  // 
  // if (onCallStaff?.phone) {
  //   return { dial: onCallStaff.phone };
  // }
  
  // 4. Default: Voicemail or automated message
  const voicemailUrl = new URL(
    '/functions/v1/twilio-voice-status',
    Deno.env.get('SUPABASE_URL')!
  ).toString();
  
  return {
    say: 'Thank you for calling. Our office is currently closed. Please leave a message after the tone.',
    record: true,
    voicemailUrl,
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers') || '';
    const requestHeaders = (acrh || 'content-type, x-twilio-signature').toLowerCase();
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': requestHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const raw = await req.text();
    const body = contentType.includes('application/x-www-form-urlencoded')
      ? parseFormEncoded(raw)
      : raw
        ? JSON.parse(raw)
        : {};

    // Verify Twilio signature
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const verifyEnabled = (Deno.env.get('TWILIO_VERIFY_SIGNATURE') ?? 'true') === 'true';
    const publicUrlOverride = Deno.env.get('TWILIO_PUBLIC_URL_VOICE_INBOUND');
    
    const sig = await verifyTwilioSignature(
      req,
      body as Record<string, string>,
      raw,
      authToken,
      verifyEnabled,
      publicUrlOverride
    );
    
    if (!sig.ok) {
      console.error('[twilio-voice-inbound] Signature verification failed', {
        provided: sig.provided,
        url: sig.url,
        tried: sig.tried,
      });
      return new Response(
        JSON.stringify({ error: 'invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract call information
    const from = body.From as string;
    const to = body.To as string;
    const callSid = body.CallSid as string;

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: 'missing from/to' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[twilio-voice-inbound] Incoming call', {
      from,
      to,
      callSid,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Determine routing
    const routing = await determineCallRouting(supabase, to);

    // Generate TwiML response
    const twiml = generateTwiML(routing);

    console.log('[twilio-voice-inbound] Routing decision', {
      to,
      routing,
    });

    // Return TwiML response
    return new Response(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    console.error('[twilio-voice-inbound] Error', e);
    return new Response(
      JSON.stringify({ error: e?.message || 'unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 2: Create Call Status Webhook (for voicemail recordings)

**File**: `supabase/functions/twilio-voice-status/index.ts`

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  parseFormEncoded,
  verifyTwilioSignature,
} from '../twilio-inbound/shared/security.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const raw = await req.text();
    const body = contentType.includes('application/x-www-form-urlencoded')
      ? parseFormEncoded(raw)
      : raw
        ? JSON.parse(raw)
        : {};

    // Verify signature
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const verifyEnabled = (Deno.env.get('TWILIO_VERIFY_SIGNATURE') ?? 'true') === 'true';
    const publicUrlOverride = Deno.env.get('TWILIO_PUBLIC_URL_VOICE_STATUS');
    
    const sig = await verifyTwilioSignature(
      req,
      body as Record<string, string>,
      raw,
      authToken,
      verifyEnabled,
      publicUrlOverride
    );
    
    if (!sig.ok) {
      console.log('[twilio-voice-status] Signature verification failed', {
        provided: sig.provided,
        url: sig.url,
      });
      return new Response(
        JSON.stringify({ error: 'invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const callSid = body.CallSid as string;
    const callStatus = body.CallStatus as string;
    const recordingUrl = body.RecordingUrl as string | undefined;
    const recordingSid = body.RecordingSid as string | undefined;
    const from = body.From as string;
    const to = body.To as string;
    const duration = body.Duration as string | undefined;

    console.log('[twilio-voice-status] Call status update', {
      callSid,
      callStatus,
      hasRecording: !!recordingUrl,
      from,
      to,
      duration,
    });

    // TODO: Store call log and voicemail recording in database
    // Example:
    // const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // const supabase = createClient(supabaseUrl, supabaseKey, {
    //   auth: { persistSession: false },
    // });
    // 
    // if (recordingUrl) {
    //   // Store voicemail recording
    //   await supabase.from('voicemails').insert({
    //     call_sid: callSid,
    //     recording_url: recordingUrl,
    //     recording_sid: recordingSid,
    //     from_number: from,
    //     to_number: to,
    //     duration_seconds: duration ? parseInt(duration) : null,
    //     created_at: new Date().toISOString(),
    //   });
    // }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[twilio-voice-status] Error', e);
    return new Response(
      JSON.stringify({ error: e?.message || 'unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 3: Configure Twilio Phone Number

You need to configure your Twilio phone number to use the webhook URL. You can do this via:

**Option A: Twilio Console (Quick Setup)**
1. Go to [Twilio Console → Phone Numbers → Manage → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your phone number
3. Under "Voice & Fax" section:
   - **A CALL COMES IN**: Set to `Webhook`
   - **URL**: `https://[your-project-ref].supabase.co/functions/v1/twilio-voice-inbound`
   - **HTTP Method**: `POST`
   - **FALLBACK URL** (optional): Set a fallback URL for redundancy

**Option B: Twilio API (Programmatic Setup)**

Create a script or API endpoint to configure phone numbers:

```typescript
// Example: Configure phone number webhook
async function configurePhoneNumberWebhook(
  phoneNumberSid: string,
  webhookUrl: string
) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`;
  
  const form = new URLSearchParams();
  form.set('VoiceUrl', webhookUrl);
  form.set('VoiceMethod', 'POST');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  
  return await response.json();
}
```

## Database Schema Recommendations

For flexible routing, consider adding these tables:

```sql
-- Call routing rules
CREATE TABLE IF NOT EXISTS public.call_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owned_number_id UUID NOT NULL REFERENCES public.owned_numbers(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('BUSINESS_HOURS', 'ON_CALL', 'DEFAULT')),
  priority INTEGER NOT NULL DEFAULT 0, -- Lower number = higher priority
  start_time TIME, -- For time-based rules
  end_time TIME,
  days_of_week INTEGER[], -- Array of day numbers (0=Sunday, 6=Saturday)
  forward_to_phone TEXT, -- E164 phone number
  voicemail_enabled BOOLEAN DEFAULT false,
  message TEXT, -- Message to play before forwarding/voicemail
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- On-call schedules
CREATE TABLE IF NOT EXISTS public.on_call_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  phone_number TEXT NOT NULL, -- E164 format
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call logs
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid TEXT UNIQUE NOT NULL,
  owned_number_id UUID REFERENCES public.owned_numbers(id),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  call_status TEXT NOT NULL,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_sid TEXT,
  routing_rule_id UUID REFERENCES public.call_routing_rules(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Enhanced Routing Logic Example

Here's an example of more sophisticated routing:

```typescript
async function determineCallRouting(
  supabase: ReturnType<typeof createClient>,
  toNumber: string
): Promise<{
  dial?: string;
  say?: string;
  record?: boolean;
  voicemailUrl?: string;
}> {
  // Find owned number
  const { data: ownedNumber } = await supabase
    .from('owned_numbers')
    .select('id')
    .eq('phone_e164', toNumber)
    .maybeSingle();
  
  if (!ownedNumber) {
    return {
      say: 'Sorry, this number is not configured.',
    };
  }

  // Get routing rules ordered by priority
  const { data: rules } = await supabase
    .from('call_routing_rules')
    .select('*')
    .eq('owned_number_id', ownedNumber.id)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (!rules || rules.length === 0) {
    // Default: forward to a default number or voicemail
    return {
      say: 'Thank you for calling. Please leave a message.',
      record: true,
      voicemailUrl: new URL('/functions/v1/twilio-voice-status', Deno.env.get('SUPABASE_URL')!).toString(),
    };
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  const dayOfWeek = now.getDay();

  // Check each rule in priority order
  for (const rule of rules) {
    if (rule.rule_type === 'BUSINESS_HOURS') {
      // Check if current time matches business hours
      if (
        rule.days_of_week?.includes(dayOfWeek) &&
        rule.start_time &&
        rule.end_time &&
        currentTime >= rule.start_time &&
        currentTime <= rule.end_time
      ) {
        if (rule.forward_to_phone) {
          return {
            say: rule.message,
            dial: rule.forward_to_phone,
          };
        }
      }
    } else if (rule.rule_type === 'ON_CALL') {
      // Check for active on-call staff
      const { data: onCallStaff } = await supabase
        .from('on_call_schedules')
        .select('phone_number')
        .eq('is_active', true)
        .lte('start_time', now.toISOString())
        .gte('end_time', now.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (onCallStaff?.phone_number) {
        return {
          say: rule.message || 'Connecting you to our on-call staff.',
          dial: onCallStaff.phone_number,
        };
      }
    } else if (rule.rule_type === 'DEFAULT') {
      // Default rule - voicemail or message
      if (rule.voicemail_enabled) {
        return {
          say: rule.message || 'Please leave a message after the tone.',
          record: true,
          voicemailUrl: new URL('/functions/v1/twilio-voice-status', Deno.env.get('SUPABASE_URL')!).toString(),
        };
      } else if (rule.forward_to_phone) {
        return {
          say: rule.message,
          dial: rule.forward_to_phone,
        };
      }
    }
  }

  // Fallback
  return {
    say: 'Thank you for calling. Our office is currently closed. Please leave a message.',
    record: true,
    voicemailUrl: new URL('/functions/v1/twilio-voice-status', Deno.env.get('SUPABASE_URL')!).toString(),
  };
}
```

## Security Best Practices

1. **Always verify Twilio signatures** - Already implemented in the code above
2. **Use HTTPS** - Supabase Edge Functions automatically use HTTPS
3. **Set environment variables** for sensitive data:
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_VERIFY_SIGNATURE` (set to `true` in production)
   - `TWILIO_PUBLIC_URL_VOICE_INBOUND` (optional, for signature verification)

## Testing

1. **Test locally** using Twilio CLI or ngrok:
   ```bash
   # Install Twilio CLI
   npm install -g twilio-cli
   
   # Login
   twilio login
   
   # Test webhook locally with ngrok
   ngrok http 54321
   # Then update Twilio webhook URL temporarily to ngrok URL
   ```

2. **Test in Supabase**:
   ```bash
   # Deploy function
   supabase functions deploy twilio-voice-inbound
   
   # Test with curl
   curl -X POST https://[project-ref].supabase.co/functions/v1/twilio-voice-inbound \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=%2B1234567890&To=%2B0987654321&CallSid=test123"
   ```

## Next Steps

1. **Deploy the functions**:
   ```bash
   supabase functions deploy twilio-voice-inbound
   supabase functions deploy twilio-voice-status
   ```

2. **Configure your Twilio phone number** to use the webhook URL

3. **Test with a real call** to verify forwarding works

4. **Implement database schema** for flexible routing rules

5. **Build admin UI** to manage routing rules, on-call schedules, etc.

## Additional Resources

- [Twilio TwiML Documentation](https://www.twilio.com/docs/voice/twiml)
- [Twilio Voice API Reference](https://www.twilio.com/docs/voice/api)
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [TwiML Dial Verb](https://www.twilio.com/docs/voice/twiml/dial)
- [TwiML Say Verb](https://www.twilio.com/docs/voice/twiml/say)
- [TwiML Record Verb](https://www.twilio.com/docs/voice/twiml/record)
