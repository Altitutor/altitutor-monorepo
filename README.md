# AltiTutor Admin App

A comprehensive CRM system for Altitutor's administrative staff.

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui
- Supabase
- React Query
- Zustand

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in the required environment variables

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run storybook` - Start Storybook

## Documentation

- UI components are built using shadcn/ui - see [components.json](components.json) for configuration

## Custom Claims-Based RLS

This project uses Supabase custom claims (user_role) for row-level security policies instead of checking the staff table. 

### User Roles

The system has three user roles:
- `ADMINSTAFF`: Admin users with full access to all data
- `TUTOR`: Tutors with read access to most data and limited write access
- `STUDENT`: Students with access only to their own data

### Setting User Roles

User roles are stored in user metadata as a custom claim. The claim is required for all new users.

To set a user's role:
1. Use the helper function in `src/lib/auth/roles.ts`: 
```typescript
import { setUserRole } from '@/lib/auth/roles';

// Set a user's role to TUTOR
await setUserRole(userId, 'TUTOR');
```

2. Or use the Supabase Edge Function directly:
```typescript
const { error } = await supabase.functions.invoke('set-user-role', {
  body: { user_id: userId, role: 'TUTOR' },
});
```

### Checking User Roles

Helper functions are available in `src/lib/auth/roles.ts`:
```typescript
import { isAdminStaff, isTutor, isStudent, isStaff } from '@/lib/auth/roles';

// Get the current user
const { data: { user } } = await supabase.auth.getUser();

// Check user roles
if (isAdminStaff(user)) {
  // User is an admin
}

if (isStaff(user)) {
  // User is either admin or tutor
}
```

## Migration Deployment

To deploy the migrations (both locally and remotely):

1. Make the deployment script executable:
```bash
chmod +x deploy-migrations.sh
```

2. Run the script:
```bash
./deploy-migrations.sh
```

3. The script will:
   - Apply migrations to your local development database
   - Ask if you want to deploy to the remote environment
   - If yes, authenticate with Supabase if needed and push the changes
 
