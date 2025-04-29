import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import readline from 'readline';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Subject data structure
interface Subject {
  name: string;
  year_level: number | null;
  curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | null;
  discipline: 'MATHEMATICS' | 'SCIENCE' | 'HUMANITIES' | 'ENGLISH' | 'ART' | 'LANGUAGE' | 'MEDICINE';
  level: string | null;
}

// All subjects to be seeded - copied from seed-subjects.ts
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

async function promptForInput(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function seedRemoteDatabase() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let supabaseUrl = '';
    let supabaseKey = '';
    
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
    
    // If not provided in command line, prompt the user
    if (!supabaseUrl) {
      supabaseUrl = await promptForInput('Enter your Supabase project URL: ');
    }
    
    if (!supabaseKey) {
      supabaseKey = await promptForInput('Enter your Supabase service role key: ');
    }
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase URL and service role key are required');
      process.exit(1);
    }
    
    console.log(`Using Supabase URL: ${supabaseUrl}`);
    
    // Confirm before proceeding with the remote database
    const confirmRemote = await promptForInput(`⚠️ WARNING: You're about to seed the remote database at ${supabaseUrl}.\nThis will DELETE all existing subjects and add ${subjects.length} new ones.\nAre you sure you want to continue? (yes/no): `);
    
    if (confirmRemote.toLowerCase() !== 'yes') {
      console.log('Operation cancelled.');
      process.exit(0);
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting subject seeding process...');
    
    // First, attempt to add MEDICINE to the enum if it doesn't exist
    try {
      // Try the add_enum_value function 
      const { error } = await supabase.rpc('add_enum_value', {
        enum_name: 'subject_discipline',
        new_value: 'MEDICINE'
      });
      
      if (error) {
        console.warn('Warning: Could not add MEDICINE to enum:', error.message);
        console.warn('Will check if MEDICINE is already available');
      } else {
        console.log('Successfully added MEDICINE to subject_discipline enum');
      }
    } catch (err) {
      console.warn('Warning: Failed to modify enum:', err);
    }
    
    // Check if MEDICINE is already in the enum
    let canUseMedicine = false;
    
    try {
      // Check if we can query for MEDICINE subjects
      const { data: testQuery, error: testError } = await supabase
        .from('subjects')
        .select('discipline')
        .eq('discipline', 'MEDICINE')
        .limit(1);
        
      if (!testError) {
        console.log('MEDICINE discipline is already available in the enum');
        canUseMedicine = true;
      } else {
        console.warn('MEDICINE discipline appears to be missing from the enum:', testError.message);
      }
    } catch (err) {
      console.warn('Error checking for MEDICINE discipline:', err);
    }
    
    // If MEDICINE is not available, filter out those subjects
    let subjectsToInsert = [...subjects];
    
    if (!canUseMedicine) {
      console.warn('Filtering out MEDICINE subjects to avoid errors');
      subjectsToInsert = subjects.filter(subject => subject.discipline !== 'MEDICINE');
      console.log(`Will insert ${subjectsToInsert.length} subjects (excluding MEDICINE subjects)`);
    } else {
      console.log(`Will insert all ${subjects.length} subjects including MEDICINE subjects`);
    }
    
    // Delete existing subjects to prevent duplicates
    const { error: deleteError } = await supabase
      .from('subjects')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Safety condition
      
    if (deleteError) {
      console.error('Error deleting existing subjects:', deleteError.message);
      rl.close();
      return;
    }
    
    console.log('Cleared existing subject data');
    
    // Insert all subjects
    const { data, error } = await supabase
      .from('subjects')
      .insert(subjectsToInsert)
      .select();
      
    if (error) {
      console.error('Error seeding subjects:', error.message);
      rl.close();
      return;
    }
    
    console.log(`Successfully added ${data?.length} subjects to the remote database`);
    console.log('Subject seeding completed successfully!');
    
    // Verify with a quick count
    const { count, error: countError } = await supabase
      .from('subjects')
      .select('*', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`Verification: Database now contains ${count} subjects`);
    }
    
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    rl.close();
  }
}

// Run the seed function
seedRemoteDatabase().catch(console.error); 