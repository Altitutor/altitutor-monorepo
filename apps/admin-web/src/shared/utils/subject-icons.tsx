import { 
  Calculator, 
  Atom, 
  Globe, 
  BookOpen, 
  Palette, 
  Languages,
  Stethoscope,
  GraduationCap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Get the appropriate icon for a subject based on its discipline
 */
export function getSubjectIcon(discipline: string | null | undefined): LucideIcon {
  if (!discipline) return GraduationCap;
  
  const disciplineUpper = discipline.toUpperCase();
  
  switch (disciplineUpper) {
    case 'MATHEMATICS':
      return Calculator;
    case 'SCIENCE':
      return Atom;
    case 'HUMANITIES':
      return Globe;
    case 'ENGLISH':
      return BookOpen;
    case 'ART':
      return Palette;
    case 'LANGUAGE':
      return Languages;
    case 'MEDICINE':
      return Stethoscope;
    default:
      return GraduationCap;
  }
}

