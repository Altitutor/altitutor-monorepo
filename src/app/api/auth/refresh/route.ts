import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Reuse the mock user from login route
const MOCK_USER = {
  id: '1',
  email: 'admin@altitutor.com',
  name: 'Admin User',
  role: 'admin' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const headersList = headers();
    const token = headersList.get('Authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    // TODO: Implement actual token validation and refresh logic
    if (token === 'mock-jwt-token') {
      // Generate a new mock token
      const newToken = 'new-mock-jwt-token';

      return NextResponse.json({
        user: MOCK_USER,
        token: newToken,
      });
    }

    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 