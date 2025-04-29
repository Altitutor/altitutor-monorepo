# Database Seeding Scripts

This directory contains scripts to seed the database with initial data.

## Available Scripts

### Subject Seeding

The `seed-subjects.ts` script populates the subjects table with predefined subjects. This includes subjects across different curricula (SACE, IB, PRESACE, PRIMARY) and disciplines (MATHEMATICS, SCIENCE, HUMANITIES, ENGLISH, MEDICINE).

#### How to Use

To seed the database with the predefined subjects:

```bash
# From the project root, using environment variables in .env.local
npm run seed:subjects

# OR using command line arguments
npx tsx src/scripts/seed-subjects.ts --url YOUR_SUPABASE_URL --key YOUR_SUPABASE_KEY
```

**Important Note:** You need to use the `service_role` key to bypass Row Level Security (RLS) when running this script. The anonymous key won't have sufficient permissions.

To get your service role key for local development:

```bash
cd supabase && supabase status
```

Look for the `service_role key` in the output.

#### What This Script Does

This script will:
1. Add 'MEDICINE' to the subject_discipline enum type if it doesn't already exist
2. Clear existing subject data to prevent duplicates
3. Insert all the predefined subjects

#### When to Use

- After initial database setup
- When the database has been reset
- When you need to restore the default set of subjects

#### Adding New Subjects

To add new subjects:

1. Edit the `subjects` array in `seed-subjects.ts`
2. Add new subjects following the existing format:
   ```typescript
   { 
     name: 'Subject Name', 
     year_level: 12, // or null if not applicable
     curriculum: 'SACE', // 'SACE', 'IB', 'PRESACE', 'PRIMARY', or null
     discipline: 'MATHEMATICS', // 'MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'MEDICINE'
     level: null // 'HL', 'SL', or null
   }
   ```
3. Run the seeding script to update the database

#### For Production Deployment

For a production environment:

1. Get your Supabase URL and service role key from your Supabase project settings
2. Run the script with those credentials:

```bash
npx tsx src/scripts/seed-subjects.ts --url https://your-project-id.supabase.co --key your-service-role-key
```

#### Database Migrations

The database setup includes these related migrations:

1. `20250429000000_add_medicine_discipline.sql` - Adds 'MEDICINE' to the subject_discipline enum
2. `20250429000001_seed_subjects.sql` - Contains SQL to seed subjects (run automatically during migrations)
3. `20250429000002_add_enum_value_function.sql` - Adds a utility function for adding enum values

These migrations are applied automatically when you run:

```bash
supabase migration up
``` 