/**
 * Utility functions for parsing file relationships (detecting solution files)
 * Separated from UI components for reusability and testability
 */

/**
 * Parse file names to detect solution relationships
 * Returns a map of filename -> solution filename (or null if not a solution)
 */
export function parseFileRelationships(files: File[]): Map<string, string | null> {
  const solutionMap = new Map<string, string | null>();
  
  // Initialize all files with no solution relationship
  files.forEach((file) => {
    solutionMap.set(file.name, null);
  });

  // Check for STUDENT pattern
  // If one filename contains the other and one has "STUDENT", 
  // the STUDENT file is the file, other is solution
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      const name1 = file1.name.toLowerCase();
      const name2 = file2.name.toLowerCase();
      
      // Remove file extensions for comparison
      const base1 = name1.replace(/\.[^/.]+$/, '');
      const base2 = name2.replace(/\.[^/.]+$/, '');
      
      const hasStudent1 = name1.includes('student');
      const hasStudent2 = name2.includes('student');
      
      if (hasStudent1 && !hasStudent2 && (base1.includes(base2) || base2.includes(base1))) {
        // file1 has STUDENT, so file2 is the solution
        solutionMap.set(file2.name, file1.name);
      } else if (hasStudent2 && !hasStudent1 && (base1.includes(base2) || base2.includes(base1))) {
        // file2 has STUDENT, so file1 is the solution
        solutionMap.set(file1.name, file2.name);
      }
    }
  }

  // Check for SOL/ANS pattern
  // If one filename contains the other and one has "SOL" or "ANS",
  // that one is the solution
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      const name1 = file1.name.toLowerCase();
      const name2 = file2.name.toLowerCase();
      
      // Remove file extensions for comparison
      const base1 = name1.replace(/\.[^/.]+$/, '');
      const base2 = name2.replace(/\.[^/.]+$/, '');
      
      const hasSolAns1 = /\b(sol|ans)\b/.test(name1);
      const hasSolAns2 = /\b(sol|ans)\b/.test(name2);
      
      if (hasSolAns1 && !hasSolAns2 && (base1.includes(base2) || base2.includes(base1))) {
        // file1 has SOL/ANS, so it's the solution for file2
        solutionMap.set(file1.name, file2.name);
      } else if (hasSolAns2 && !hasSolAns1 && (base1.includes(base2) || base2.includes(base1))) {
        // file2 has SOL/ANS, so it's the solution for file1
        solutionMap.set(file2.name, file1.name);
      }
    }
  }

  return solutionMap;
}
