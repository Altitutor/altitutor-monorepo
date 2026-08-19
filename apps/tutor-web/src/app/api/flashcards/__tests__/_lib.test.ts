/** @jest-environment node */

import { listAccessibleFlashcards, persistTopicFlashcardOrder } from '../_lib';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/shared/lib/supabase/service-role', () => ({
  getServiceRoleClient: jest.fn(),
}));

function query(result: unknown) {
  const value = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    order: jest.fn().mockResolvedValue(result),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  return value;
}

describe('listAccessibleFlashcards', () => {
  it('signs all flashcard images in one batch while preserving cards without images', async () => {
    const userClient = {
      rpc: jest.fn().mockResolvedValue({ data: true }),
      from: jest.fn((table: string) => {
        if (table === 'vtutor_topics') {
          return query({ data: { id: 'topic-id' } });
        }
        return query({
          data: [
            { id: 'card-1', topic_id: 'topic-id', card_type: 'cloze', index: 1, image_storage_path: 'one.png' },
            { id: 'card-2', topic_id: 'topic-id', card_type: 'cloze', index: 2, image_storage_path: null },
            { id: 'card-3', topic_id: 'topic-id', card_type: 'cloze', index: 3, image_storage_path: 'two.png' },
          ],
          error: null,
        });
      }),
    };
    jest.mocked(createClient).mockReturnValue(userClient as never);

    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: 'one.png', signedUrl: 'https://signed/one' },
        { path: 'two.png', signedUrl: 'https://signed/two' },
      ],
      error: null,
    });
    jest.mocked(getServiceRoleClient).mockReturnValue({
      storage: { from: jest.fn(() => ({ createSignedUrls })) },
    } as never);

    const cards = await listAccessibleFlashcards('topic-id');

    expect(createSignedUrls).toHaveBeenCalledWith(['one.png', 'two.png'], 3600);
    expect(cards.map((card) => card.image_url)).toEqual([
      'https://signed/one',
      undefined,
      'https://signed/two',
    ]);
  });
});

describe('persistTopicFlashcardOrder', () => {
  it('reorders a topic through one atomic database call', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    await persistTopicFlashcardOrder(
      { rpc } as never,
      'topic-id',
      ['card-3', 'card-1', 'card-2'],
    );

    expect(rpc).toHaveBeenCalledWith('tutor_reorder_topic_flashcards', {
      p_topic_id: 'topic-id',
      p_ordered_ids: ['card-3', 'card-1', 'card-2'],
    });
  });
});
