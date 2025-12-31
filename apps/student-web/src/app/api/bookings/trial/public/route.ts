import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Simple in-memory rate limiter (replace with Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, email: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email}`;
  
  // IP-based limiting (10 requests/hour)
  const ipLimit = rateLimitMap.get(ipKey);
  if (ipLimit && ipLimit.resetAt > now) {
    if (ipLimit.count >= 10) {
      return { allowed: false, error: 'Too many requests from this IP. Please try again later.' };
    }
    rateLimitMap.set(ipKey, { count: ipLimit.count + 1, resetAt: ipLimit.resetAt });
  } else {
    rateLimitMap.set(ipKey, { count: 1, resetAt: now + 3600000 }); // 1 hour
  }
  
  // Email-based limiting (1 booking/day)
  const emailLimit = rateLimitMap.get(emailKey);
  if (emailLimit && emailLimit.resetAt > now) {
    if (emailLimit.count >= 1) {
      return { allowed: false, error: 'You have already booked a trial session today. Please try again tomorrow.' };
    }
    rateLimitMap.set(emailKey, { count: emailLimit.count + 1, resetAt: emailLimit.resetAt });
  } else {
    rateLimitMap.set(emailKey, { count: 1, resetAt: now + 86400000 }); // 24 hours
  }
  
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Rate limiting
    const rateLimit = checkRateLimit(ip, body.student_email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.error },
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
    
    // Validate curriculum enum
    if (!['SACE', 'IB', 'PRESACE', 'PRIMARY'].includes(body.curriculum)) {
      return NextResponse.json(
        { error: 'Invalid curriculum' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Call database function (parameters must be in order: required first, then optional)
    const { data, error } = await supabase.rpc('create_public_trial_booking' as any, {
      p_student_first_name: body.student_first_name,
      p_student_last_name: body.student_last_name,
      p_student_email: body.student_email,
      p_student_phone: body.student_phone || null,
      p_curriculum: body.curriculum,
      p_start_at: body.start_at,
      p_end_at: body.end_at,
      p_year_level: body.year_level || null,
      p_parent_first_name: body.skip_parent_details ? null : (body.parent_first_name || null),
      p_parent_last_name: body.skip_parent_details ? null : (body.parent_last_name || null),
      p_parent_email: body.skip_parent_details ? null : (body.parent_email || null),
      p_parent_phone: body.skip_parent_details ? null : (body.parent_phone || null),
    });
    
    if (error) {
      // Handle specific error codes
      if (error.code === 'P0001' || error.message.includes('STUDENT_EXISTS')) {
        return NextResponse.json(
          { 
            error: 'STUDENT_EXISTS',
            message: 'A student with this email already exists'
          },
          { status: 409 } // Conflict
        );
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to create booking' },
        { status: 400 }
      );
    }
    
      if (!data) {
        return NextResponse.json(
          { error: 'No data returned from booking function' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        session_id: data.session_id,
        student_id: data.student_id,
      });
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

