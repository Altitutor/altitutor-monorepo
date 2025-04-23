import { NextResponse } from 'next/server';
import { z } from 'zod';

// TODO: Replace with actual user validation logic
const MOCK_USER = {
  id: '1',
  email: 'admin@altitutor.com',
  name: 'Admin User',
  role: 'admin' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // TODO: Replace with actual authentication logic
    if (email === 'admin@altitutor.com' && password === 'password123') {
      // Generate a mock JWT token (replace with actual JWT implementation)
      const token = 'mock-jwt-token';

      return NextResponse.json({
        user: MOCK_USER,
        token,
      });
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 