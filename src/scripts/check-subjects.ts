import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

async function checkSubjects() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
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
    console.error('Please provide Supabase URL and key using one of these methods:');
    console.error('1. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    console.error('2. Pass arguments: --url <URL> --key <KEY>');
    process.exit(1);
  }

  console.log(`Using Supabase URL: ${supabaseUrl}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get total count and sample
  const { data, error, count } = await supabase
    .from('subjects')
    .select('*', { count: 'exact' });
  
  if (error) {
    console.error('Error querying subjects:', error.message);
    return;
  }
  
  console.log('Total subjects in database:', count);
  
  if (data && data.length > 0) {
    console.log('Sample subjects:');
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
  } else {
    console.log('No subjects found in the database.');
  }
}

checkSubjects().catch(console.error); 