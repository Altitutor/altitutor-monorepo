import { recoverStudentLogin } from '@altitutor/shared/auth/server';

export function POST(request: Request) {
  return recoverStudentLogin(request, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  });
}
