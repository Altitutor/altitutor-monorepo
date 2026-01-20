/**
 * Tests for subject icon utilities
 * Tests icon selection based on discipline
 */

import { getSubjectIcon } from '../subject-icons';
import {
  Calculator,
  Atom,
  Globe,
  BookOpen,
  Palette,
  Languages,
  Stethoscope,
  GraduationCap,
} from 'lucide-react';

describe('getSubjectIcon', () => {
  it('should return Calculator for MATHEMATICS', () => {
    const icon = getSubjectIcon('MATHEMATICS');
    expect(icon).toBe(Calculator);
  });

  it('should return Calculator for mathematics (lowercase)', () => {
    const icon = getSubjectIcon('mathematics');
    expect(icon).toBe(Calculator);
  });

  it('should return Atom for SCIENCE', () => {
    const icon = getSubjectIcon('SCIENCE');
    expect(icon).toBe(Atom);
  });

  it('should return Globe for HUMANITIES', () => {
    const icon = getSubjectIcon('HUMANITIES');
    expect(icon).toBe(Globe);
  });

  it('should return BookOpen for ENGLISH', () => {
    const icon = getSubjectIcon('ENGLISH');
    expect(icon).toBe(BookOpen);
  });

  it('should return Palette for ART', () => {
    const icon = getSubjectIcon('ART');
    expect(icon).toBe(Palette);
  });

  it('should return Languages for LANGUAGE', () => {
    const icon = getSubjectIcon('LANGUAGE');
    expect(icon).toBe(Languages);
  });

  it('should return Stethoscope for MEDICINE', () => {
    const icon = getSubjectIcon('MEDICINE');
    expect(icon).toBe(Stethoscope);
  });

  it('should return GraduationCap for unknown discipline', () => {
    const icon = getSubjectIcon('UNKNOWN_DISCIPLINE');
    expect(icon).toBe(GraduationCap);
  });

  it('should return GraduationCap for null discipline', () => {
    const icon = getSubjectIcon(null);
    expect(icon).toBe(GraduationCap);
  });

  it('should return GraduationCap for undefined discipline', () => {
    const icon = getSubjectIcon(undefined);
    expect(icon).toBe(GraduationCap);
  });

  it('should handle mixed case', () => {
    const icon = getSubjectIcon('MaThEmAtIcS');
    expect(icon).toBe(Calculator);
  });

  it('should handle empty string', () => {
    const icon = getSubjectIcon('');
    expect(icon).toBe(GraduationCap);
  });
});
