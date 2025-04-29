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

async function promptForInput(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function checkRemoteSubjects() {
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
    
    console.log(`\nChecking subjects in database: ${supabaseUrl}`);
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total count and sample
    const { data, error, count } = await supabase
      .from('subjects')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('Error querying subjects:', error.message);
      return;
    }
    
    console.log('\n=== SUBJECT DATABASE VERIFICATION ===');
    console.log(`Total subjects in database: ${count}`);
    
    if (data && data.length > 0) {
      console.log('\nSample subjects:');
      console.log(data.slice(0, 5).map(s => ({
        name: s.name,
        year_level: s.year_level,
        curriculum: s.curriculum,
        discipline: s.discipline,
        level: s.level
      })));
      
      // Count subjects by discipline
      const disciplineCounts: Record<string, number> = {};
      data.forEach(subject => {
        const discipline = subject.discipline || 'UNKNOWN';
        disciplineCounts[discipline] = (disciplineCounts[discipline] || 0) + 1;
      });
      
      console.log('\nSubjects by discipline:');
      Object.entries(disciplineCounts).forEach(([discipline, count]) => {
        console.log(`- ${discipline}: ${count}`);
      });
      
      // Count subjects by curriculum
      const curriculumCounts: Record<string, number> = {};
      data.forEach(subject => {
        const curriculum = subject.curriculum || 'UNKNOWN';
        curriculumCounts[curriculum] = (curriculumCounts[curriculum] || 0) + 1;
      });
      
      console.log('\nSubjects by curriculum:');
      Object.entries(curriculumCounts).forEach(([curriculum, count]) => {
        console.log(`- ${curriculum}: ${count}`);
      });

      console.log('\n=== VERIFICATION COMPLETE ===');
      console.log(`✅ Found ${count} subjects in the remote database`);
    } else {
      console.log('⚠️ No subjects found in the database.');
    }
    
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    rl.close();
  }
}

// Run the check function
checkRemoteSubjects().catch(console.error); 