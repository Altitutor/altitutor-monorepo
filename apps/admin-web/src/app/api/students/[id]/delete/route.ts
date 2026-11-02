import type { NextRequest } from 'next/server';
import { changeStudentRetirement } from '@/features/students/server/retirement';

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return changeStudentRetirement(params.id, 'retire');
}
