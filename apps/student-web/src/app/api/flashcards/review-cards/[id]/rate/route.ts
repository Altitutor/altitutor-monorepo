import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const rating = body.rating;
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const supabase = createClient() as any;
  const { data, error } = await supabase.rpc('student_rate_flashcard_review_card', {
    p_review_card_id: params.id,
    p_rating: rating,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
