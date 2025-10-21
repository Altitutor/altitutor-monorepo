'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';
import { Button } from '@altitutor/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { resolvedTheme } = useTheme();
  const router = useRouter();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClientComponentClient<Database>();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      
      if (authError) {
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Authentication failed: No user or session data');
      }

      // Redirect to dashboard on successful login
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <Image 
            src={resolvedTheme === 'dark' ? "/images/logo-icon-dark.svg" : "/images/logo-icon-light.svg"}
            alt="Altitutor Logo" 
            width={120} 
            height={120} 
            className="mb-4"
          />
        </div>
        <h1 className="text-2xl font-bold">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Sign in to access your admin dashboard
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-darkBlue dark:text-brand-lightBlue"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
                <div className="text-right">
                  <Button 
                    variant="link" 
                    className="px-0 text-brand-mediumBlue dark:text-brand-lightBlue" 
                    asChild
                  >
                    <Link href="/forgot-password">Forgot password?</Link>
                  </Button>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-darkBlue dark:hover:bg-brand-lightBlue/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
} 