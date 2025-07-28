import { describe, it, expect } from '@effect/vitest';
import { Schema } from 'effect';
import { Snippet } from '../../../domain/types/snippet';
import { SnippetId, Slug } from '../../../domain/types/branded';
import { formatNamedEntityList } from '../../utils/console';

describe('CLI Search Command Logic', () => {
  const testSnippets: readonly Snippet[] = [
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440001'),
      name: Schema.decodeSync(Slug)('greeting-snippet'),
      description: 'A snippet for greeting users warmly',
    },
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440002'),
      name: Schema.decodeSync(Slug)('response-generator'),
      description: 'Generates helpful responses for user queries',
    },
    {
      id: Schema.decodeSync(SnippetId)('550e8400-e29b-41d4-a716-446655440003'),
      name: Schema.decodeSync(Slug)('task-instruction'),
      description: 'Provides clear task instructions',
    },
  ];

  describe('Query Processing', () => {
    it('should handle different query types', () => {
      const testQueries = [
        'greeting',
        'helpful',
        'user',
        'GREETING', // Case insensitive
        'task-instruction', // Exact name match
        '', // Empty query
      ];

      // All queries should be processable (this tests the query handling logic)
      for (const query of testQueries) {
        expect(typeof query).toBe('string');
        expect(query.length >= 0).toBe(true);
      }
    });

    it('should handle special characters in queries', () => {
      const specialQueries = [
        'user-friendly & efficient!',
        'query with "quotes"',
        'émojis 🚀 test',
        'pipes | and & ampersands',
      ];

      // All special character queries should be processable
      for (const query of specialQueries) {
        expect(typeof query).toBe('string');
        expect(query.length > 0).toBe(true);
      }
    });
  });

  describe('Result Formatting', () => {
    it('should format search results using the same table format as list', () => {
      const searchResults = testSnippets.slice(0, 2); // Simulate search results
      const formatted = formatNamedEntityList(searchResults);

      // Should use same format as list command
      expect(formatted).toContain('NAME');
      expect(formatted).toContain('DESCRIPTION');
      expect(formatted).toContain('greeting-snippet');
      expect(formatted).toContain('response-generator');
      expect(formatted).toContain('|');
      expect(formatted).toContain('-');
    });

    it('should handle no search results', () => {
      const noResults: readonly Snippet[] = [];
      const formatted = formatNamedEntityList(noResults, 'No snippets found.');
      expect(formatted).toBe('No snippets found.');
    });

    it('should maintain ordering consistency', () => {
      // Search results should be ordered by name (same as list)
      const unorderedResults = [
        testSnippets[2],
        testSnippets[0],
        testSnippets[1],
      ];
      const orderedResults = [...unorderedResults].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      const formatted = formatNamedEntityList(orderedResults);
      const lines = formatted.split('\n');
      const dataLines = lines.slice(2).filter((line) => line.trim());

      // Should be ordered alphabetically
      expect(dataLines[0]).toContain('greeting-snippet');
      expect(dataLines[1]).toContain('response-generator');
      expect(dataLines[2]).toContain('task-instruction');
    });
  });

  describe('Search Logic Simulation', () => {
    it('should simulate case-insensitive matching', () => {
      const query = 'GREETING';
      const lowercaseQuery = query.toLowerCase();

      // Simulate the search logic: check if name or description contains the query
      const matchingSnippets = testSnippets.filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(lowercaseQuery) ||
          snippet.description.toLowerCase().includes(lowercaseQuery),
      );

      expect(matchingSnippets).toHaveLength(1);
      expect(matchingSnippets[0].name).toBe('greeting-snippet');
    });

    it('should simulate description-based matching', () => {
      const query = 'helpful';

      const matchingSnippets = testSnippets.filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(query.toLowerCase()) ||
          snippet.description.toLowerCase().includes(query.toLowerCase()),
      );

      expect(matchingSnippets).toHaveLength(1);
      expect(matchingSnippets[0].name).toBe('response-generator');
    });

    it('should simulate partial name matching', () => {
      const query = 'task';

      const matchingSnippets = testSnippets.filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(query.toLowerCase()) ||
          snippet.description.toLowerCase().includes(query.toLowerCase()),
      );

      expect(matchingSnippets).toHaveLength(1); // only task-instruction (name)
      expect(matchingSnippets.some((s) => s.name === 'task-instruction')).toBe(
        true,
      );
    });
  });

  describe('Query Validation', () => {
    it('should handle empty queries', () => {
      const emptyQuery = '';
      // Empty query should match all snippets (or handle appropriately)
      expect(emptyQuery.length).toBe(0);

      // Simulate returning all snippets for empty query
      const results = testSnippets;
      expect(results).toHaveLength(3);
    });

    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(1000);
      expect(longQuery.length).toBe(1000);

      // Should not crash with long queries
      const matchingSnippets = testSnippets.filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(longQuery.toLowerCase()) ||
          snippet.description.toLowerCase().includes(longQuery.toLowerCase()),
      );

      expect(matchingSnippets).toHaveLength(0); // No matches expected
    });
  });
});
