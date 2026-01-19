// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  parseFormEncoded,
  verifyTwilioSignature as verifySignature,
} from '../twilio-inbound/shared/security.ts';

function parseFormEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) obj[key] = value;
  return obj;
}

async function verifyTwilioSignature(
  req: Request,
  bodyObj: Record<string, string>,
  rawBody: string
): Promise<{ ok: boolean; provided?: string; url?: string; tried?: string[] }> {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const verifyEnabled =
    (Deno.env.get('TWILIO_VERIFY_SIGNATURE') ?? 'true') === 'true';
  const publicUrlOverride = Deno.env.get('TWILIO_PUBLIC_URL_VOICE_INBOUND');
  return await verifySignature(
    req,
    bodyObj,
    rawBody,
    authToken,
    verifyEnabled,
    publicUrlOverride
  );
}

/**
 * Escape XML special characters for TwiML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Routing decision type
 */
type RoutingDecision = {
  dial?: string; // Phone number to dial (E164 format)
  say?: string; // Text-to-speech message
  play?: string; // Audio file URL
  callerId?: string; // Caller ID to use when dialing (must be your Twilio number)
};

/**
 * Generate TwiML XML response for call handling
 */
function generateTwiML(decision: RoutingDecision): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<Response>'];
  
  if (decision.say) {
    parts.push(`<Say voice="alice">${escapeXml(decision.say)}</Say>`);
  }
  
  if (decision.play) {
    parts.push(`<Play>${escapeXml(decision.play)}</Play>`);
  }
  
  if (decision.dial) {
    // Use <Dial> to forward call and preserve caller ID
    // The callerId attribute should be your Twilio number (the one receiving the call)
    const dialAttrs: string[] = [];
    if (decision.callerId) {
      dialAttrs.push(`callerId="${escapeXml(decision.callerId)}"`);
    }
    const dialTag = dialAttrs.length > 0 
      ? `<Dial ${dialAttrs.join(' ')}>`
      : '<Dial>';
    parts.push(`${dialTag}${escapeXml(decision.dial)}</Dial>`);
  }
  
  parts.push('</Response>');
  return parts.join('\n');
}

/**
 * Get current time in Adelaide timezone
 */
function getAdelaideTime(): { date: Date; time: string; dayOfWeek: number } {
  // Convert UTC to Adelaide timezone
  const now = new Date();
  const adelaideTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Adelaide' }));
  const time = adelaideTime.toTimeString().slice(0, 5); // HH:MM format
  const dayOfWeek = adelaideTime.getDay(); // 0=Sunday, 6=Saturday
  
  return { date: adelaideTime, time, dayOfWeek };
}

/**
 * Check if current time is within business hours
 */
async function isBusinessHours(
  supabase: ReturnType<typeof createClient>,
  dayOfWeek: number,
  currentTime: string
): Promise<boolean> {
  const { data: openingHours } = await supabase
    .from('opening_hours')
    .select('start_time, end_time')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .maybeSingle();

  if (!openingHours) {
    return false;
  }

  return currentTime >= openingHours.start_time && currentTime <= openingHours.end_time;
}

/**
 * Get on-call staff phone number if available
 */
async function getOnCallStaff(
  supabase: ReturnType<typeof createClient>,
  dayOfWeek: number,
  currentTime: string
): Promise<string | null> {
  // Query on-call schedules matching current time
  // Note: Using gte/lte for TIME comparison - currentTime must be between start_time and end_time
  const { data: onCallSchedules } = await supabase
    .from('on_call_schedules')
    .select('staff_id')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .lte('start_time', currentTime) // currentTime >= start_time
    .gte('end_time', currentTime)   // currentTime <= end_time
    .order('created_at', { ascending: true })
    .limit(1);

  if (!onCallSchedules || onCallSchedules.length === 0) {
    return null;
  }

  const staffId = onCallSchedules[0].staff_id;

  // Query staff phone number
  const { data: staff } = await supabase
    .from('staff')
    .select('phone_number')
    .eq('id', staffId)
    .not('phone_number', 'is', null)
    .maybeSingle();

  return staff?.phone_number || null;
}

/**
 * Determine call routing based on business logic
 */
async function determineCallRouting(
  supabase: ReturnType<typeof createClient>,
  toNumber: string
): Promise<RoutingDecision> {
  // Find owned number configuration
  const { data: ownedNumber } = await supabase
    .from('owned_numbers')
    .select('id, phone_e164')
    .eq('phone_e164', toNumber)
    .maybeSingle();

  if (!ownedNumber) {
    console.warn('[twilio-voice-inbound] Owned number not found', { toNumber });
    return {
      say: 'Sorry, this number is not configured. Please contact support.',
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
    console.warn('[twilio-voice-inbound] No routing rules configured', { ownedNumberId: ownedNumber.id });
    return {
      say: 'Thank you for calling. Our office is currently closed. Please call back during business hours.',
    };
  }

  // Get current time in Adelaide timezone
  const { time: currentTime, dayOfWeek } = getAdelaideTime();

  // Evaluate rules in priority order
  for (const rule of rules) {
    if (rule.rule_type === 'BUSINESS_HOURS') {
      // Check if current time is within business hours
      const isOpen = await isBusinessHours(supabase, dayOfWeek, currentTime);
      
      if (isOpen && rule.forward_to_phone) {
        console.log('[twilio-voice-inbound] Routing: BUSINESS_HOURS', {
          toNumber,
          forwardTo: rule.forward_to_phone,
          currentTime,
          dayOfWeek,
        });
        return {
          dial: rule.forward_to_phone,
          callerId: ownedNumber.phone_e164,
        };
      }
    } else if (rule.rule_type === 'ON_CALL') {
      // Check if staff is on-call (only if not business hours)
      const isOpen = await isBusinessHours(supabase, dayOfWeek, currentTime);
      
      if (!isOpen) {
        const onCallPhone = await getOnCallStaff(supabase, dayOfWeek, currentTime);
        
        if (onCallPhone) {
          console.log('[twilio-voice-inbound] Routing: ON_CALL', {
            toNumber,
            forwardTo: onCallPhone,
            currentTime,
            dayOfWeek,
          });
          return {
            dial: onCallPhone,
            callerId: ownedNumber.phone_e164,
          };
        }
      }
    } else if (rule.rule_type === 'DEFAULT') {
      // Default rule - play message
      if (rule.message_type === 'AUDIO' && rule.audio_url) {
        console.log('[twilio-voice-inbound] Routing: DEFAULT (AUDIO)', {
          toNumber,
          audioUrl: rule.audio_url,
        });
        return {
          play: rule.audio_url,
        };
      } else if (rule.message_text) {
        console.log('[twilio-voice-inbound] Routing: DEFAULT (TTS)', {
          toNumber,
          message: rule.message_text,
        });
        return {
          say: rule.message_text,
        };
      }
    }
  }

  // Ultimate fallback
  console.warn('[twilio-voice-inbound] No matching rule, using fallback', { toNumber });
  return {
    say: 'Thank you for calling. Our office is currently closed. Please call back during business hours.',
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
    const sig = await verifyTwilioSignature(req, body as Record<string, string>, raw);
    if (!sig.ok) {
      console.error('[twilio-voice-inbound] Signature verification failed', {
        provided: sig.provided,
        url: sig.url,
        tried: sig.tried,
        hasAuthToken: !!Deno.env.get('TWILIO_AUTH_TOKEN'),
        verifyEnabled: (Deno.env.get('TWILIO_VERIFY_SIGNATURE') ?? 'true') === 'true',
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
      from,
      routing: {
        ...routing,
        dial: routing.dial ? '***' : undefined, // Don't log full phone numbers
      },
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
