import type { NextRequest } from 'next/server';
import { changeStudentRetirement } from '@/features/students/server/retirement';

export function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  return changeStudentRetirement(params.id, 'retire');
}
