import { NextResponse } from 'next/server';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // TODO: Replace with actual email sending logic
    // For now, we'll simulate success for the test email
    if (email === 'admin@altitutor.com') {
      // In a real implementation:
      // 1. Generate a secure reset token
      // 2. Store the token with an expiration time
      // 3. Send an email with a reset link
      
      return NextResponse.json({
        message: 'Password reset instructions sent',
      });
    }

    // For security, always return success even if email doesn't exist
    return NextResponse.json({
      message: 'If an account exists, password reset instructions have been sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 