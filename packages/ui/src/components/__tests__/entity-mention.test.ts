/** @jest-environment jsdom */
import {generateHTML, generateJSON, getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {DOMSerializer} from '@tiptap/pm/model';
import {EntityMention} from '../../extensions/entity-mention';

it('renders and round-trips a named entity with an SVG icon in editor and saved HTML', () => {
  const extensions = [StarterKit, EntityMention];
  const content = {type: 'doc', content: [{type: 'paragraph', content: [{type: 'mention', attrs: {id: 'student-id', type: 'students', label: 'Alex Student'}}]}]};
  const schema = getSchema(extensions);
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(schema.nodeFromJSON(content).content);
  const icon = fragment.querySelector('svg')!;
  expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg');
  const html = generateHTML(content, extensions);
  expect(html).toContain('data-label="Alex Student"');
  const restored = generateJSON(html, extensions);
  expect(restored.content?.[0]?.content?.[0]?.attrs).toMatchObject({id: 'student-id', type: 'students', label: 'Alex Student'});
});
