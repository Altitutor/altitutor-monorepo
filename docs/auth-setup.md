# Authentication Setup Guide

## Password Reset Flow (PKCE)

This app uses the modern PKCE (Proof Key for Code Exchange) flow for password resets, which is more secure than the legacy implicit flow.

### How it works:

1. User requests password reset via `/forgot-password`
2. Supabase sends email with link to `https://your-project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=http://localhost:3000/auth/callback`
3. User clicks link → Supabase auth server
4. Supabase redirects to `/auth/callback` with a `code` parameter
5. Our callback route exchanges the code for a session using `exchangeCodeForSession()`
6. User is redirected to `/reset-password` with an active session
7. User can now update their password

### Required Supabase Configuration

#### 1. Email Templates

Go to **Authentication → Email Templates** in your Supabase dashboard and update the **Reset Password** template:

```html
<h2>Reset Password</h2>

<p>Hello,</p>

<p>Follow this link to reset the password for your account:</p>

<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
    style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    Reset Password
  </a>
</p>

<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password</p>

<p>If you didn't request this, you can safely ignore this email.</p>

<p>Thanks,<br>
The Altitutor Team</p>
```

#### 2. Redirect URLs

Add these to **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:3000/auth/callback` (for development)
- `https://yourdomain.com/auth/callback` (for production)

#### 3. Site URL

Set your **Site URL** in **Authentication → URL Configuration**:

- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

### Testing the Flow

1. Go to `/forgot-password`
2. Enter your email
3. Check your email for the reset link
4. Click the link
5. You should be redirected to `/reset-password` with an active session
6. Update your password
7. Get redirected to login with success message

### Troubleshooting

#### "Invalid or missing reset token"

- Check that the `/auth/callback` route exists and is working
- Verify the redirect URLs are configured in Supabase
- Check browser network tab for any 404s or errors in the callback

#### "No active session found"

- The code exchange might have failed
- Check server logs for errors in the callback route
- Verify the email template is using the correct URL format

#### Email link doesn't work

- Check that the Site URL is configured correctly
- Verify the email template is using the correct variables
- Make sure the redirect URL in the email matches your configured URLs

### Implementation Files

- `/src/app/auth/callback/route.ts` - Handles code exchange
- `/src/app/(auth)/reset-password/page.tsx` - Reset password UI
- `/src/components/auth/ResetPasswordForm.tsx` - Reset form component
- `/src/lib/supabase/api/auth.ts` - Auth API functions 