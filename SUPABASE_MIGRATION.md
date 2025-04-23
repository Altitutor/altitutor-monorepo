# Migrating to Supabase

This document outlines the steps to migrate the AltiTutor Admin App from a local Dexie database to Supabase.

## Prerequisites

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new Supabase project
3. Get your Supabase URL and Anon Key from the project settings

## Environment Setup

Create a `.env.local` file in the root of your project with the following variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Authentication Settings
NEXT_PUBLIC_AUTH_MODE=supabase

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
```

## Setting Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the contents of `src/lib/supabase/schema.sql` into the query editor
5. Run the query to create all necessary tables and RLS policies

## Installing Dependencies

Install the required Supabase packages:

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

## Migration Process

1. Start your Next.js development server
   ```bash
   npm run dev
   ```

2. Navigate to the Migration Tool page at `/settings/migration`

3. Click "Start Migration" to migrate your data from local Dexie database to Supabase

4. Once migration is complete, your data is now available in Supabase

## Switching to Supabase in Production

When you're ready to switch entirely to Supabase:

1. Verify all data has been migrated correctly
2. Set the `NEXT_PUBLIC_AUTH_MODE=supabase` environment variable in your production environment
3. Deploy your application

## Troubleshooting

- If you encounter errors during migration, check the browser console for detailed error messages
- Ensure your Supabase project has the correct RLS policies configured
- Verify that your environment variables are correctly set

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js and Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase Auth Helpers for Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs) 