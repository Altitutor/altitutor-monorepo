import { NextResponse } from 'next/server';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // TODO: Replace with actual password reset logic
    // For now, we'll simulate success for the test token
    if (token === 'test-reset-token') {
      // In a real implementation:
      // 1. Verify the token is valid and not expired
      // 2. Update the user's password in the database
      // 3. Invalidate the reset token
      // 4. Log the user out of all sessions

      return NextResponse.json({
        message: 'Password successfully reset',
      });
    }

    return NextResponse.json(
      { error: 'Invalid or expired reset token' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid password format' },
        { status: 400 }
      );
    }

    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
} 