/**
 * Tests for extractMentions utility
 * Extracts mention nodes from Tiptap JSONContent
 */

import { extractMentions } from '../extractMentions';
import type { JSONContent } from '@altitutor/ui';

describe('extractMentions', () => {
  it('should return empty array for null content', () => {
    expect(extractMentions(null)).toEqual([]);
  });

  it('should return empty array for undefined content', () => {
    expect(extractMentions(undefined)).toEqual([]);
  });

  it('should return empty array for empty JSONContent', () => {
    const emptyDoc: JSONContent = {
      type: 'doc',
      content: [],
    };
    expect(extractMentions(emptyDoc)).toEqual([]);
  });

  it('should return empty array for content with no mentions', () => {
    const docWithoutMentions: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractMentions(docWithoutMentions)).toEqual([]);
  });

  it('should extract a single mention', () => {
    const docWithMention: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'mention',
              attrs: {
                id: 'student-1',
                type: 'student',
                label: 'John Doe',
              },
            },
          ],
        },
      ],
    };
    expect(extractMentions(docWithMention)).toEqual([
      {
        id: 'student-1',
        type: 'student',
        label: 'John Doe',
      },
    ]);
  });

  it('should extract nested mentions from multiple paragraphs', () => {
    const docWithNestedMentions: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                id: 'staff-1',
                type: 'staff',
                label: 'Jane Smith',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Assigned to ' },
            {
              type: 'mention',
              attrs: {
                id: 'student-2',
                type: 'student',
                label: 'Alice Johnson',
              },
            },
          ],
        },
      ],
    };
    expect(extractMentions(docWithNestedMentions)).toEqual([
      {
        id: 'staff-1',
        type: 'staff',
        label: 'Jane Smith',
      },
      {
        id: 'student-2',
        type: 'student',
        label: 'Alice Johnson',
      },
    ]);
  });

  it('should deduplicate mentions by type:id', () => {
    const docWithDuplicateMentions: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                id: 'student-1',
                type: 'student',
                label: 'John Doe',
              },
            },
            { type: 'text', text: ' and ' },
            {
              type: 'mention',
              attrs: {
                id: 'student-1',
                type: 'student',
                label: 'John Doe',
              },
            },
          ],
        },
      ],
    };
    expect(extractMentions(docWithDuplicateMentions)).toEqual([
      {
        id: 'student-1',
        type: 'student',
        label: 'John Doe',
      },
    ]);
  });

  it('should keep mentions with same id but different types', () => {
    const docWithSameIdDifferentTypes: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                id: 'entity-1',
                type: 'student',
                label: 'Student One',
              },
            },
            {
              type: 'mention',
              attrs: {
                id: 'entity-1',
                type: 'staff',
                label: 'Staff One',
              },
            },
          ],
        },
      ],
    };
    expect(extractMentions(docWithSameIdDifferentTypes)).toEqual([
      {
        id: 'entity-1',
        type: 'student',
        label: 'Student One',
      },
      {
        id: 'entity-1',
        type: 'staff',
        label: 'Staff One',
      },
    ]);
  });

  it('should handle deeply nested content', () => {
    const docWithDeepNesting: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'mention',
                  attrs: {
                    id: 'parent-1',
                    type: 'parent',
                    label: 'Bob Parent',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractMentions(docWithDeepNesting)).toEqual([
      {
        id: 'parent-1',
        type: 'parent',
        label: 'Bob Parent',
      },
    ]);
  });
});
