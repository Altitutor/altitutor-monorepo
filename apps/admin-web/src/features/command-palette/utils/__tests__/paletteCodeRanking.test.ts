import type { PaletteEntity } from '../../model';
import { scorePaletteEntity } from '../matchScoring';

const subject = { type: 'subject' as const, id: 'biology', title: '12BIO' };
const topic: PaletteEntity = { type: 'topic', id: 'topic', title: '2.1 Cells', code: '2.1', parents: [subject] };
const file: PaletteEntity = { type: 'file', id: 'file', title: '2.1N Cells notes', code: '2.1N', parents: [subject] };

it.each(['2.1', '12BIO 2.1'])('prioritises the exact topic code in %s', (query) => {
  expect(scorePaletteEntity(topic, query)).toBeGreaterThan(scorePaletteEntity(file, query));
});

it.each(['2.1N', '12BIO 2.1N'])('prioritises the exact file code in %s', (query) => {
  expect(scorePaletteEntity(file, query)).toBeGreaterThan(scorePaletteEntity(topic, query));
});
