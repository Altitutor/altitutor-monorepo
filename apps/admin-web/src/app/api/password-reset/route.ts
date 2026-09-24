import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

type ResetUserType = 'student' | 'tutor' | 'admin';
type ResetAction = 'send-email' | 'generate-link' | 'manual-reset';

function getBaseUrl(userType: ResetUserType) {
  const isDev = process.env.NODE_ENV === 'development';

  if (userType === 'student') {
    return isDev
      ? 'http://localhost:3001'
      : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
  }

  if (userType === 'tutor') {
    return isDev
      ? 'http://localhost:3002'
      : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
  }

  return isDev
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.altitutor.com');
}

function buildRecoveryCallbackUrl(userType: ResetUserType, tokenHash: string) {
  const url = new URL('/auth/callback', getBaseUrl(userType));
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'recovery');
  return url.toString();
}

async function requireAdminUser() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single<{ role: string }>();

  if (
    staffError ||
    !staffData ||
    (staffData.role !== 'ADMINSTAFF' && staffData.role !== 'OFFICE_ADMIN')
  ) {
    return { error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }) };
  }

  return { error: null };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const {
      action,
      userId,
      email,
      userType,
      password,
    } = body as {
      action?: ResetAction;
      userId?: string;
      email?: string;
      userType?: ResetUserType;
      password?: string;
    };

    if (!action || !['send-email', 'generate-link', 'manual-reset'].includes(action)) {
      return NextResponse.json({ error: 'Invalid password reset action' }, { status: 400 });
    }

    if (!userId || !email || !userType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, userType' },
        { status: 400 }
      );
    }

    if (action === 'manual-reset') {
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });

      if (error) {
        console.error('Failed to manually reset password:', error);
        captureApiError(error, "/api/password-reset");
        return NextResponse.json(
          { error: `Failed to reset password: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const redirectTo = `${getBaseUrl(userType)}/auth/callback`;

    if (action === 'send-email') {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error('Failed to send password reset email:', error);
        captureApiError(error, "/api/password-reset");
        return NextResponse.json(
          { error: `Failed to send password reset email: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error('Failed to generate password reset link:', error);
      captureApiError(error, "/api/password-reset");
      return NextResponse.json(
        { error: `Failed to generate password reset link: ${error.message}` },
        { status: 500 }
      );
    }

    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) {
      return NextResponse.json(
        { error: 'Password reset link generated but no token hash returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      link: buildRecoveryCallbackUrl(userType, tokenHash),
    }, { status: 200 });
  } catch (error) {
    captureApiError(error, "/api/password-reset");
    console.error('Unexpected password reset error:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
