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
    
    // Validate booking dates - prevent past bookings
    const startAt = new Date(body.start_at);
    const endAt = new Date(body.end_at);
    const now = new Date();
    
    if (startAt < now) {
      return NextResponse.json(
        { error: 'Cannot book sessions in the past' },
        { status: 400 }
      );
    }
    
    if (endAt <= startAt) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Map year level: 'Reception' -> 0, numeric strings -> numbers
    let yearLevel: number | null = null;
    if (body.year_level) {
      if (body.year_level === 'Reception') {
        yearLevel = 0;
      } else {
        yearLevel = parseInt(body.year_level, 10);
      }
    }
    
    // Call database function (parameters must be in order: required first, then optional)
    const { data, error } = await supabase.rpc('create_public_trial_booking' as any, {
      p_student_first_name: body.student_first_name,
      p_student_last_name: body.student_last_name,
      p_student_email: body.student_email,
      p_student_phone: body.student_phone || null,
      p_curriculum: body.curriculum,
      p_start_at: body.start_at,
      p_end_at: body.end_at,
      p_year_level: yearLevel,
      p_parent_first_name: body.skip_parent_details ? null : (body.parent_first_name || null),
      p_parent_last_name: body.skip_parent_details ? null : (body.parent_last_name || null),
      p_parent_email: body.skip_parent_details ? null : (body.parent_email || null),
      p_parent_phone: body.skip_parent_details ? null : (body.parent_phone || null),
    });
    
    if (error) {
      // Log the full error for debugging
      console.error('[TRIAL BOOKING API] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      const errorMessage = error.message || '';
      
      // Handle STUDENT_EXISTS error (email already exists)
      if (error.code === 'P0001' && errorMessage.includes('STUDENT_EXISTS')) {
        return NextResponse.json(
          { 
            error: 'STUDENT_EXISTS',
            message: 'A student with this email already exists'
          },
          { status: 409 } // Conflict
        );
      }
      
      // Handle phone number conflicts (phone already associated with parent/staff)
      if (error.code === 'P0001' && (
        errorMessage.includes('already associated with a parent') ||
        errorMessage.includes('already associated with a staff member') ||
        errorMessage.includes('already associated with another student')
      )) {
        return NextResponse.json(
          { 
            error: 'PHONE_CONFLICT',
            message: errorMessage || 'This phone number is already associated with another account'
          },
          { status: 409 } // Conflict
        );
      }
      
      // Check for unique constraint violation (23505 is PostgreSQL unique violation)
      if (error.code === '23505' || errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        // Try to determine if it's email or phone conflict
        if (errorMessage.toLowerCase().includes('email')) {
          return NextResponse.json(
            { 
              error: 'STUDENT_EXISTS',
              message: 'A student with this email already exists'
            },
            { status: 409 } // Conflict
          );
        } else {
          return NextResponse.json(
            { 
              error: 'PHONE_CONFLICT',
              message: 'This phone number is already associated with another account'
            },
            { status: 409 } // Conflict
          );
        }
      }
      
      return NextResponse.json(
        { error: errorMessage || 'Failed to create booking' },
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

