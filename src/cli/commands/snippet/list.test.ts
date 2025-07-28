import { describe, it, expect } from '@effect/vitest';
import { Schema } from 'effect';
import { Snippet } from '../../../domain/types/snippet';
import { SnippetId, Slug } from '../../../domain/types/branded';
import { formatNamedEntityList } from '../../utils/console';

describe('CLI List Command Logic', () => {
  const testSnippets: readonly Snippet[] = [
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440001'),
      name: Schema.decodeSync(Slug)('greeting-snippet'),
      description: 'A snippet for greeting users',
    },
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440002'),
      name: Schema.decodeSync(Slug)('response-snippet'),
      description: 'A snippet for generating responses',
    },
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440003'),
      name: Schema.decodeSync(Slug)('task-snippet'),
      description: 'A snippet for task instructions',
    },
  ];

  describe('Output Formatting', () => {
    it('should format list of snippets as table', () => {
      const formatted = formatNamedEntityList(testSnippets);

      // Should contain headers
      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');

      // Should contain all snippet names
      expect(formatted).toContain('greeting-snippet');
      expect(formatted).toContain('response-snippet');
      expect(formatted).toContain('task-snippet');

      // Should contain all descriptions
      expect(formatted).toContain('A snippet for greeting users');
      expect(formatted).toContain('A snippet for generating responses');
      expect(formatted).toContain('A snippet for task instructions');

      // Should have table structure
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');

      // Should have proper number of lines (header + separator + 3 data rows)
      const lines = formatted.split('\n');
      expect(lines).toHaveLength(5);
    });

    it('should handle empty snippet list', () => {
      const formatted = formatNamedEntityList([], 'No snippets found.');
      expect(formatted).toBe('No snippets found.');
    });

    it('should handle single snippet list', () => {
      const formatted = formatNamedEntityList(
        [testSnippets[0]],
        'No snippets found.',
      );

      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('greeting-snippet');
      expect(formatted).toContain('A snippet for greeting users');

      const lines = formatted.split('\n');
      expect(lines).toHaveLength(3); // header + separator + 1 data row
    });
  });

  describe('Column Alignment', () => {
    it('should align columns properly with varying name lengths', () => {
      const varyingLengthSnippets: readonly Snippet[] = [
        {
          id: Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440001',
          ),
          name: Schema.decodeSync(Slug)('a'),
          description: 'Short name',
        },
        {
          id: Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440002',
          ),
          name: Schema.decodeSync(Slug)(
            'very-long-snippet-name-that-extends-beyond-normal',
          ),
          description: 'Long name',
        },
      ];

      const formatted = formatNamedEntityList(varyingLengthSnippets);
      const lines = formatted.split('\n');

      // Should maintain table structure
      expect(lines.length).toBe(4); // header + separator + 2 data rows
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');
    });

    it('should calculate correct column width', () => {
      const formatted = formatNamedEntityList(testSnippets);
      const lines = formatted.split('\n');
      const headerLine = lines[0];
      const separatorLine = lines[1];

      // The NAME column width should be based on the longest name or 'NAME' header
      const longestName = Math.max(
        ...testSnippets.map((s) => s.name.length),
        'NAME'.length,
      );

      // Check that the separator has the right number of dashes for the NAME column
      const nameColumnDashes = separatorLine.split(' | ')[0];
      expect(nameColumnDashes.length).toBe(longestName);

      // Check that header padding matches
      const nameColumnHeader = headerLine.split(' | ')[0];
      expect(nameColumnHeader.length).toBe(longestName);
    });
  });

  describe('Special Characters', () => {
    it('should handle snippets with special characters in descriptions', () => {
      const specialSnippets: readonly Snippet[] = [
        {
          id: Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440001',
          ),
          name: Schema.decodeSync(Slug)('special-snippet'),
          description: 'Description with "quotes" and | pipes',
        },
        {
          id: Schema.decodeSync(SnippetId)(
            '550e8400-e29b-41d4-a716-446655440002',
          ),
          name: Schema.decodeSync(Slug)('unicode-snippet'),
          description: 'Description with émojis 🚀 and ünïcödé',
        },
      ];

      const formatted = formatNamedEntityList(specialSnippets);

      // Should not break the table format
      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('special-snippet');
      expect(formatted).toContain('unicode-snippet');
      expect(formatted).toContain('"quotes"');
      expect(formatted).toContain('émojis 🚀');
    });
  });
});
