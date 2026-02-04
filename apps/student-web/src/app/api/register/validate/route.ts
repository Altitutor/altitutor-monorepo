import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS (this is a public endpoint for registration validation)
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if token exists in students table
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, email, phone, school, curriculum, year_level, status, user_id, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (studentError) {
      console.error('Error fetching student:', studentError);
      return NextResponse.json(
        { error: 'Failed to validate token', details: studentError.message },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if student is already fully registered (has account AND status is ACTIVE)
    if (student.user_id && student.status === 'ACTIVE') {
      return NextResponse.json({
        valid: false,
        alreadyRegistered: true,
        error: 'This student is already fully registered',
      }, { status: 200 });
    }
    
    // If student has account but hasn't registered (status != ACTIVE), allow registration
    // The registration flow will skip password creation since they already have an account
    const hasAccount = !!student.user_id;
    const skipPassword = hasAccount; // Skip password if they already have an account

    // Fetch parents linked to this student
    const { data: parentsData } = await supabaseAdmin
      .from('parents_students')
      .select('parent_id, parents(id, first_name, last_name, email, phone)')
      .eq('student_id', student.id);

    const parents = parentsData
      ?.map((ps: unknown) => {
        if (typeof ps === 'object' && ps !== null && 'parents' in ps) {
          return ps.parents;
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null) || [];

    // Fetch subjects for this student
    const { data: subjectsData } = await supabaseAdmin
      .from('students_subjects')
      .select('subject_id, subjects(id, name, year_level, curriculum, color, short_name, long_name)')
      .eq('student_id', student.id);

    const subjects = subjectsData
      ?.map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'subjects' in item) {
          return item.subjects;
        }
        return null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null) || [];

    return NextResponse.json({
      valid: true,
      alreadyRegistered: false,
      hasAccount, // Indicate if student already has an account (skip password step)
      skipPassword, // Flag to skip password creation in registration flow
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || '',
        phone: student.phone || '',
        school: student.school || '',
        curriculum: student.curriculum || '',
        year_level: student.year_level || null,
      },
      parents: parents.map((p: unknown) => {
        if (typeof p === 'object' && p !== null && 'id' in p && 'first_name' in p && 'last_name' in p) {
          return {
            id: String(p.id),
            first_name: String(p.first_name),
            last_name: String(p.last_name),
            email: 'email' in p ? String(p.email || '') : '',
            phone: 'phone' in p ? String(p.phone || '') : '',
          };
        }
        return { id: '', first_name: '', last_name: '', email: '', phone: '' };
      }),
      subjects: subjects.map((s: unknown) => {
        if (typeof s === 'object' && s !== null && 'id' in s && 'name' in s) {
          return {
            id: String(s.id),
            name: String(s.name),
            year_level: 'year_level' in s && typeof s.year_level === 'number' ? s.year_level : null,
            curriculum: 'curriculum' in s ? String(s.curriculum || '') : '',
            color: 'color' in s ? String(s.color || '') : '',
          };
        }
        return { id: '', name: '', year_level: null, curriculum: '', color: '' };
      }),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
