import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Subject data structure
interface Subject {
  name: string;
  year_level: number | null;
  curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | null;
  discipline: 'MATHEMATICS' | 'SCIENCE' | 'HUMANITIES' | 'ENGLISH' | 'ART' | 'LANGUAGE' | 'MEDICINE';
  level: string | null;
}

// All subjects to be seeded
const subjects: Subject[] = [
  // MATHEMATICS subjects
  // SACE MATHEMATICS
  { name: 'Mathematical Methods', year_level: 12, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Specialist Mathematics', year_level: 12, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'General Mathematics', year_level: 12, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Essential Mathematics', year_level: 12, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematical Methods', year_level: 11, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Specialist Mathematics', year_level: 11, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'General Mathematics', year_level: 11, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Essential Mathematics', year_level: 11, curriculum: 'SACE', discipline: 'MATHEMATICS', level: null },

  // PRESACE MATHEMATICS
  { name: 'Mathematics', year_level: 10, curriculum: 'PRESACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 9, curriculum: 'PRESACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 8, curriculum: 'PRESACE', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 7, curriculum: 'PRESACE', discipline: 'MATHEMATICS', level: null },

  // PRIMARY MATHEMATICS
  { name: 'Mathematics', year_level: 6, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 5, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 4, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 3, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 2, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },
  { name: 'Mathematics', year_level: 1, curriculum: 'PRIMARY', discipline: 'MATHEMATICS', level: null },

  // IB MATHEMATICS
  { name: 'Mathematics AA', year_level: 12, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'HL' },
  { name: 'Mathematics AA', year_level: 12, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'SL' },
  { name: 'Mathematics AI', year_level: 12, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'HL' },
  { name: 'Mathematics AI', year_level: 12, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'SL' },
  { name: 'Mathematics AA', year_level: 11, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'HL' },
  { name: 'Mathematics AA', year_level: 11, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'SL' },
  { name: 'Mathematics AI', year_level: 11, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'HL' },
  { name: 'Mathematics AI', year_level: 11, curriculum: 'IB', discipline: 'MATHEMATICS', level: 'SL' },

  // SCIENCE subjects
  // SACE SCIENCE
  { name: 'Biology', year_level: 12, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Chemistry', year_level: 12, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Physics', year_level: 12, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Biology', year_level: 11, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Chemistry', year_level: 11, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Psychology', year_level: 12, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Psychology', year_level: 11, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Nutrition', year_level: 12, curriculum: 'SACE', discipline: 'SCIENCE', level: null },
  { name: 'Nutrition', year_level: 11, curriculum: 'SACE', discipline: 'SCIENCE', level: null },

  // PRESACE SCIENCE
  { name: 'Science', year_level: 10, curriculum: 'PRESACE', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 9, curriculum: 'PRESACE', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 8, curriculum: 'PRESACE', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 7, curriculum: 'PRESACE', discipline: 'SCIENCE', level: null },

  // PRIMARY SCIENCE
  { name: 'Science', year_level: 6, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 5, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 4, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 3, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 2, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },
  { name: 'Science', year_level: 1, curriculum: 'PRIMARY', discipline: 'SCIENCE', level: null },

  // IB SCIENCE
  { name: 'Physics', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Physics', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },
  { name: 'Chemistry', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Chemistry', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },
  { name: 'Biology', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Biology', year_level: 12, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },
  { name: 'Physics', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Physics', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },
  { name: 'Chemistry', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Chemistry', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },
  { name: 'Biology', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'HL' },
  { name: 'Biology', year_level: 11, curriculum: 'IB', discipline: 'SCIENCE', level: 'SL' },

  // HUMANITIES subjects
  // IB HUMANITIES
  { name: 'Economics', year_level: 12, curriculum: 'IB', discipline: 'HUMANITIES', level: 'HL' },
  { name: 'Economics', year_level: 12, curriculum: 'IB', discipline: 'HUMANITIES', level: 'SL' },
  { name: 'Economics', year_level: 11, curriculum: 'IB', discipline: 'HUMANITIES', level: 'HL' },
  { name: 'Economics', year_level: 11, curriculum: 'IB', discipline: 'HUMANITIES', level: 'SL' },

  // ENGLISH subjects
  // SACE ENGLISH
  { name: 'English General', year_level: 12, curriculum: 'SACE', discipline: 'ENGLISH', level: null },
  { name: 'English Literature', year_level: 12, curriculum: 'SACE', discipline: 'ENGLISH', level: null },
  { name: 'English General', year_level: 11, curriculum: 'SACE', discipline: 'ENGLISH', level: null },
  { name: 'English Literature', year_level: 11, curriculum: 'SACE', discipline: 'ENGLISH', level: null },

  // PRESACE ENGLISH
  { name: 'English', year_level: 9, curriculum: 'PRESACE', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 8, curriculum: 'PRESACE', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 7, curriculum: 'PRESACE', discipline: 'ENGLISH', level: null },

  // PRIMARY ENGLISH
  { name: 'English', year_level: 6, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 5, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 4, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 3, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 2, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },
  { name: 'English', year_level: 1, curriculum: 'PRIMARY', discipline: 'ENGLISH', level: null },

  // IB ENGLISH
  { name: 'English', year_level: 12, curriculum: 'IB', discipline: 'ENGLISH', level: 'HL' },
  { name: 'English', year_level: 12, curriculum: 'IB', discipline: 'ENGLISH', level: 'SL' },
  { name: 'English', year_level: 11, curriculum: 'IB', discipline: 'ENGLISH', level: 'HL' },
  { name: 'English', year_level: 11, curriculum: 'IB', discipline: 'ENGLISH', level: 'SL' },

  // MEDICINE subjects
  { name: 'UCAT', year_level: null, curriculum: null, discipline: 'MEDICINE', level: null },
  { name: 'Medicine Interview', year_level: null, curriculum: null, discipline: 'MEDICINE', level: null },
];

async function seedSubjects() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Check for command line arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--url' && i + 1 < args.length) {
        supabaseUrl = args[i + 1];
        i++;
      } else if (args[i] === '--key' && i + 1 < args.length) {
        supabaseKey = args[i + 1];
        i++;
      }
    }
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Missing required connection information.');
      console.error('Please provide Supabase URL and anon key using one of these methods:');
      console.error('1. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
      console.error('2. Pass arguments: --url <URL> --key <KEY>');
      console.error('Example: npx tsx src/scripts/seed-subjects.ts --url http://localhost:54321 --key eyJ...');
      process.exit(1);
    }
    
    console.log(`Using Supabase URL: ${supabaseUrl}`);
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting subject seeding process...');
    console.log(`Total subjects to add: ${subjects.length}`);
    
    // First, add MEDICINE to subject_discipline enum if it doesn't exist
    try {
      const { error } = await supabase.rpc('add_enum_value', {
        enum_name: 'subject_discipline',
        new_value: 'MEDICINE'
      });
      
      if (error) {
        console.warn('Warning: Could not add MEDICINE to enum. It might already exist or you need admin privileges:', error.message);
      } else {
        console.log('Successfully added MEDICINE to subject_discipline enum');
      }
    } catch (err) {
      console.warn('Warning: Failed to modify enum. This is expected in production environments:', err);
    }
    
    // Delete existing subjects to prevent duplicates
    const { error: deleteError } = await supabase
      .from('subjects')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Safety condition
      
    if (deleteError) {
      console.error('Error deleting existing subjects:', deleteError.message);
      return;
    }
    
    console.log('Cleared existing subject data');
    
    // Insert all subjects
    const { data, error } = await supabase
      .from('subjects')
      .insert(subjects)
      .select();
      
    if (error) {
      console.error('Error seeding subjects:', error.message);
      return;
    }
    
    console.log(`Successfully added ${data?.length} subjects to the database`);
    console.log('Subject seeding completed successfully!');
    
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

// Run the seed function
seedSubjects().catch(console.error); 